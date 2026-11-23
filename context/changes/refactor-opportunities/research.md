---
date: 2026-11-23T09:55:53+01:00
researcher: Claude Opus 5.5 (sesja Piotr S)
git_commit: 939a56d
branch: main
repository: spring-petclinic
topic: "Które problemy z pet-duplicate-name-analysis warto naprawić, w jakim docelowym kształcie i w jakiej kolejności (refactor opportunities)"
tags: [research, refactor-opportunities, PetController, Owner, schema, binder, unique_owner_pet_name, verified]
status: complete
last_updated: 2026-11-23
last_updated_by: Claude Opus 5.5 (sesja Piotr S)
verified_at_commit: 939a56d
last_updated_note: "Weryfikacja twierdzeń strukturalnych przez ast-grep 0.51.3 (Java, tylko tryb wyszukiwania) i grep (SQL, konfiguracja, CI) na 939a56d. Poprawiono numery linii PostgresIntegrationTests w miejscu, dodano sekcję 'Weryfikacja twierdzeń (ast-grep)'. Ranking i werdykty intencjonalności bez zmian."
---

# Research: refactor opportunities z długu opisanego w pet-duplicate-name-analysis

**Date**: 2026-11-23T09:55:53+01:00
**Researcher**: Claude Opus 5.5 (sesja Piotr S)
**Git Commit**: `939a56d` (kod produktu bez zmian od `500158f`; `git status src` pusty)
**Branch**: main
**Repository**: spring-petclinic

Ścieżki Java są względem `src/main/java/org/springframework/samples/petclinic/` (`PC` = `owner/PetController.java`, `O` = `owner/Owner.java`), zasoby względem `src/main/resources/`. Testy leżą pod `src/test/java/org/springframework/samples/petclinic/`. Numery D1–D9, V1–V18 i S1–S7 odnoszą się do `context/changes/pet-duplicate-name-analysis/research.md` (dalej: **raport źródłowy**), którego ustalenia traktuję jako zebrane dowody.

Oznaczenia: **[E]** evidence (kod, git, PR na GitHubie), **[I]** inference (wniosek, nieuruchomiony), **[U]** unknown.

Tryb: wyłącznie odczyt. Nie zmieniono kodu, niczego nie uruchomiono (bez aplikacji, baz, buildów i testów). Archeologia: `git log/-S/-L/blame/show` oraz odczyt publicznych PR i issue upstreamu przez `gh api` (tylko GET). Trzy sub-agenty pracowały równolegle: obecny kształt, historia i intencjonalność, wykonalność migracji. Twierdzenia rozstrzygające ranking sprawdziłem sam (commity `d90e284`, `d381fb6`, `8805eaa`, `4725753`, `c953442`, `83ff9a5`, `c7ee170`, `676db04`, `80ff54a`; `PetValidator.java:25,36,46`; `PetControllerTests.java:77-86,202-229`; `O:67-70,147-157`).

## Research Question

Które z problemów zapisanych w raporcie źródłowym warto naprawić, w jakim docelowym kształcie i w jakiej kolejności? Eksploracja bez refaktoru i bez decyzji. Wynik kończy się rankingiem opcji z trade-offami dla osobnej sesji planowania.

## Summary

- Z raportu źródłowego wypisałem **22 problemy** (§0). **9 z nich tworzy 8 kandydatów** (C1–C8, ich naprawa zmienia strukturę kodu; C1 łączy D1 i D2). Pozostałe 13 to luki testowe, konfiguracyjne i niewiadome, które zachowałem jako wejście do oceny kosztu i wykonalności.
- **Ranking (propozycja dla planowania):**
  1. **C3+C4: reguła „unikalne imię” jako jedna metoda agregatu `Owner` z predykatem po id.** Przypadkowa złożoność, sprzeczna z kierunkiem opiekunów (`4725753`: przejścia stanu do agregatu) [E]. Koszt S, żadna niewiadoma tego nie blokuje. Usuwa ukrytą zależność od `open-in-view=false` (D7), a test, który miał jej pilnować, przechodzi tylko dzięki kolejności zwierząt w fixture (§C4) [E]. Zbiera też dwa bloki `catch` w jedno miejsce, co upraszcza #2.
  2. **C1: rozpoznawanie naruszenia po nazwie ograniczenia z przyczyny wyjątku, ograniczenie nazwane w trzech dialektach.** Przypadkowa złożoność: PR #2573 nie rozważał alternatyw i nie nazwał ograniczenia w MySQL [E]. Najwyższy koszt długu, bo na profilu `mysql` najpewniej daje 500 [I, U1]. Weryfikację części MySQL blokuje U1, a istniejące bazy U-OLD.
  3. **C5: allow-lista pól w binderach `OwnerController` i `VisitController`.** Rozwinięcie świadomego kierunku z `c7ee170` („Be more careful with allowed fields in binders”) [E]. Koszt S. Pilność zależy od U-D9, ale sama zmiana nie.
- **Odrzucone:**
  - **C2** (cztery implementacje „tego samego imienia”): właściwa naprawa wymaga decyzji produktowej o relacji równoważności imion (akcenty, spacje). Zatrzymuję się na tym etapie.
  - **C6** (limit 30 znaków): walidator zamiast `@Size` to świadomy wybór (`80ff54a`). Zostaje tania poprawka, nie refaktor.
  - **C7** (brak narzędzia migracji): koszt L, nieproporcjonalny do zakresu.
  - **C8** (`getPet(String)` bez produkcyjnych wywołań): trywialne, do wchłonięcia przez #1.
- **Kolejność:** #1 → #2 → #3. #1 nie zależy od żadnej niewiadomej i jest prerekwizytem porządkowym dla #2. #3 jest niezależna i może iść równolegle.

## Detailed Findings

### 0. Inwentarz problemów z raportu źródłowego i klasyfikacja (do audytu)

**KANDYDAT** = naprawa zmieniłaby strukturę kodu. **WEJŚCIE** = nie-kandydat, zachowany jako wejście do oceny kosztu i wykonalności.

| # | Problem (etykieta w raporcie źródłowym) | Źródło | Klasa | Gdzie użyty |
|---|---|---|---|---|
| 1 | Dopasowanie napisu `unique_owner_pet_name` ↔ nazwy ograniczeń w H2 i Postgresie | D1, V2 | **KANDYDAT C1** | – |
| 2 | Ograniczenie bez nazwy w MySQL, rozjazd z napisem | D2, S1 | **KANDYDAT C1** | – |
| 3 | Reguła „to samo imię” w czterech implementacjach | D3, §1.5 | **KANDYDAT C2** | – |
| 4 | Test współbieżności nie odróżnia błędu formularza od 500 | D4 | WEJŚCIE | osłony C1 |
| 5 | Limit 30 znaków: walidator ↔ `VARCHAR(30)` ↔ `TEXT` ↔ brak `@Size` | D5, V15 | **KANDYDAT C6** | – |
| 6 | Brak klucza `size` w `messages*.properties` | D5 | WEJŚCIE (i18n) | C6 |
| 7 | Istniejące bazy ↔ treść `schema.sql`, brak narzędzia migracji | D6, S3, S7 | **KANDYDAT C7** | blokery C1, C2 |
| 8 | Poprawność sprawdzenia przy edycji zależy od `open-in-view=false` | D7 | **KANDYDAT C4** | – |
| 9 | Reguła domenowa w kontrolerze, dwa identyczne `catch`, dwa warianty sprawdzenia | D8, V3, V6 | **KANDYDAT C3** | – |
| 10 | Bindery ownera i wizyty nie blokują `pets[…]`, a zapis kaskadowy omija sprawdzenie | D9, V7 | **KANDYDAT C5** | – |
| 11 | `Owner.getPet(String)` bez produkcyjnych wywołań | V9 | **KANDYDAT C8** | – |
| 12 | Kod `duplicate` ↔ klucz w 10 plikach `messages*` (dług tani) | §2.2 | WEJŚCIE | koszt C3 |
| 13 | Tekst „is already in use” ↔ `PetClinicConcurrencyTests:86` (dług tani) | §2.2 | WEJŚCIE | osłony C1 |
| 14 | Testy kontrolera podstawiają wymyślony komunikat wyjątku | §2.3, V16 | WEJŚCIE | koszt C1 |
| 15 | Mock `findById` zwraca jeden obiekt `Owner` (wariant OSIV) | §2.3, V16 | WEJŚCIE | osłony C4 |
| 16 | 5 z 10 niepokrytych gałęzi `PC` leży na ścieżce duplikatu | §2.3 | WEJŚCIE | osłony C1, C3 |
| 17 | Brak testu duplikatu na profilach `mysql` i `postgres` | §2.3 | WEJŚCIE | osłony C1 |
| 18 | `db/mysql/user.sql` nieuruchamiany, `docker-compose.yml:12-13` montuje nieistniejący `./conf.d` | §1.5, korekty mapy | WEJŚCIE (konfiguracja) | C2 |
| 19 | Brak `@ControllerAdvice` i `@ExceptionHandler`, 500 przez `error.html` | §1.3, V5 | WEJŚCIE | skutek C1, C5 |
| 20 | Regułę zna jedna osoba (autor `e0db9b1`) | D8, T3 | WEJŚCIE (bus factor) | koszt C1, C3 |
| 21 | Hub `Owner` (39 commitów) i hub `messages*` (11 plików) | §3.1 | WEJŚCIE (blast radius) | koszt C3, C6 |
| 22 | Otwarte niewiadome U1, U-PG, U-VAR, U-OLD, U-D9 | Open Questions 1–5 | WEJŚCIE (blokery) | §Niewiadome |

Kandydaci złączeni na etapie rankingu: **C3 i C4** mają jeden docelowy kształt (jedna metoda agregatu z predykatem po id), więc w rankingu występują razem.

### C1. Rozpoznawanie naruszenia po napisie, MySQL bez nazwy ograniczenia

**Obecny kształt**
- `isDuplicatePetNameViolation` (`PC:202-205`) sprawdza tylko `ex.getMessage().toLowerCase().contains("unique_owner_pet_name")`. Nie przechodzi po `getCause()` i nie patrzy na SQLState [E]. Wywołują ją dwa identyczne `catch` (`PC:128-134`, `PC:170-176`) [E, V3].
- W lokalnym `~/.m2` jest `hibernate-core 7.4.1.Final`. Jego `org.hibernate.exception.ConstraintViolationException` ma `getConstraintName()` i `getKind()` z `ConstraintKind.UNIQUE` [E, stałe w pliku `.class`]. Że ta wersja trafia do builda, wynika z BOM-u Boota 4.1.0 (`pom.xml:7-8`) [I].
- Spring tłumaczy wyjątek Hibernate'a na `DataIntegrityViolationException` i dokleja `constraint [<nazwa>]` do komunikatu (`HibernateExceptionTranslator`, spring-orm 7.0.8) [E, raport źródłowy §1.3]. Oryginalny wyjątek z nazwą ograniczenia jest więc dostępny strukturalnie przez łańcuch przyczyn [I, mocne]. Czy dla duplikatu Spring zwraca podklasę `DuplicateKeyException`: [U], bo bez `javap` nie odczytano rozgałęzień.
- Czy nazwę dla każdego dialektu wydobywa `ViolatedConstraintNameExtractor`: [U]. Dla MySQL z nienazwanym kluczem nazwa i tak nie będzie `unique_owner_pet_name` (`db/mysql/schema.sql:47`) [E].
- W `src/main` nie ma właściciela translacji: 0 `@ControllerAdvice`, 0 `@ExceptionHandler`, 0 własnych `SQLExceptionTranslator` [E, V5 + grep].

**Historia i intencjonalność**
- `e0db9b1` (2026-07-14) = PR #2573, scalony 2026-07-16, **0 komentarzy i 0 review** [E, `gh api`]. Opis PR: *„Graceful Exception Translation: catch `DataIntegrityViolationException`, verify if it is the specific `unique_owner_pet_name` violation”*. Dla MySQL PR wprost podaje `UNIQUE (owner_id, name)` bez nazwy [E].
- Alternatyw (SQLState, `getConstraintName()`) nikt nie rozważał, a jedyna późniejsza zmiana (`88e37c1`, issue #2584) dotyczy Postgresa [E].
- **Werdykt: przypadkowa złożoność.** Pewność wysoka co do braku decyzji, średnia co do skutku na MySQL (U1).

**Wykonalność**
- Reuse, bez nowej abstrakcji: odczyt nazwy ograniczenia z przyczyny w istniejącej metodzie `PC:202`. Osobny translator albo `@ControllerAdvice` ma sens dopiero przy drugim takim ograniczeniu, a dziś nie ma drugiego [I].
- Osłony:
  - testy kontrolera przypinają **format komunikatu**, a nie zachowanie bazy (`PetControllerTests:167-168`, `:258-259`), więc zmiana sposobu rozpoznania wymaga ich przepisania [E, V16],
  - test współbieżności liczy 500 jako zwykłą porażkę (D4),
  - CI uruchamia `./mvnw -B verify` (`.github/workflows/maven-build.yml:28-29`) i `./gradlew build` (`gradle-build.yml:30-31`) [E]. Testy MySQL (Testcontainers, `@Testcontainers(disabledWithoutDocker=true)`, `MySqlIntegrationTests.java:43-50`) i Postgres (docker compose `PostgresIntegrationTests.java:51-52`, `assumeTrue` `:68` (raport: `:50-53`)) mają w CI Dockera [I: runner ubuntu-latest]. Że się nie pomijają po cichu: [U], brak logów Actions.
- Blokery: **U1** blokuje weryfikację części MySQL. **U-PG** jest słabym blokerem (indeks ma nazwę, `db/postgres/schema.sql:45`). **U-OLD** blokuje nazwanie ograniczenia w istniejących bazach MySQL, bo ograniczenie siedzi wewnątrz `CREATE TABLE IF NOT EXISTS` (S3) [E].
- Koszt: **S–M**. Kod jest drobny, koszt leży w testach na dwóch silnikach i w decyzji o U-OLD.

### C2. Reguła „to samo imię” w czterech implementacjach

**Obecny kształt**
- Cztery implementacje [E, raport źródłowy §1.5]:
  - Java: `equalsIgnoreCase` (`O:150`),
  - H2: `VARCHAR_IGNORECASE(30)` (`db/h2/schema.sql:48`),
  - Postgres: `LOWER(name)` w indeksie (`db/postgres/schema.sql:45`) na kolumnie `TEXT` (`:38`),
  - MySQL: `VARCHAR(30)` bez `COLLATE` (`db/mysql/schema.sql:40`), więc decyduje collation serwera [U].
- Normalizacji nie ma nigdzie: `NamedEntity.setName` to zwykłe przypisanie (`model/NamedEntity.java:41-43`), brak `@PrePersist`/`@PreUpdate`, brak `StringTrimmerEditor` i `registerCustomEditor` [E, grep 0]. Jedyne `strip()` jest w `OwnerController:103` (V12).
- Punkty zaczepienia [E]:
  - `NamedEntity.setName`, wspólny dla `Pet`, `PetType` i `Specialty`, więc zmiana objęłaby wszystkie trzy,
  - wzorzec `Formatter` (`PetTypeFormatter.java:36-37`),
  - binder `pet` (`PC:94-98`).

**Historia i intencjonalność**
- Ignorowanie wielkości liter w Javie jest w repo od pierwszego commita (`521d01d`, 2009, `toLowerCase().equals`). `3a61275` (2023) zmienił to na `equalsIgnoreCase`, a `fdc40a7` (2024) usunął zbędne `toLowerCase()` [E].
- H2 `VARCHAR_IGNORECASE` i Postgres `LOWER(name)` weszły w `e0db9b1`. Opis PR #2573: *„To preserve the existing application behavior, the database constraints are implemented in a case-insensitive manner, matching the current Java validation (`equalsIgnoreCase()`)”* [E].
- `db/mysql/user.sql` z `utf8_general_ci` pochodzi z `5d57e0d` (2020) i nie ma związku z regułą [E].
- **Werdykt: mieszany.** Ignorowanie wielkości liter jest świadome (pewność wysoka). Rozproszenie na cztery miejsca i zależność MySQL od collation serwera to przypadkowa złożoność (pewność średnio-wysoka). Czy akcenty i spacje mają się liczyć: [U], w historii nie ma żadnego zapisu.

**Wykonalność: tu kończy się struktura**
- Strukturalnie wystarczyłaby jedna funkcja postaci kanonicznej w domenie oraz jawne `COLLATE` lub wyrażenie w każdym DDL [I].
- Jaka ma być ta postać (czy „Zoe” = „Zoë”, czy „Leo ” = „Leo”, NFC, przycinanie), to **decyzja o pojęciu biznesowym**, a nie o strukturze kodu. Zgodnie z twardą granicą zatrzymuję się tu: to przedmiot osobnej, późniejszej analizy.
- Blokery: **U-VAR** (wymaga też U1 i U-PG) i **U-OLD** (zmiana collation albo indeksu na istniejącej bazie to migracja danych).
- Koszt: **M**, i dopiero po decyzji produktowej.

### C3. Reguła domenowa w kontrolerze

**Obecny kształt**
- Dodawanie: `pet.isNew() && owner.getPet(name, true) != null` (`PC:111`). Edycja: `owner.getPet(petName, false)` i `!Objects.equals(existingPet.getId(), pet.getId())` (`PC:151-155`). To dwa warianty, nie kopie (V6). Bloki `catch` są identyczne (V3) [E].
- `PC` zależy wprost od `OwnerRepository` i `PetTypeRepository` (`PC:53-60`). W `src/main` jest 0 `@Service` [E], a `@Transactional` występuje tylko w `VetRepository.java:44,54` (V11).
- Co już daje agregat [E]:
  - `addPet` (`O:100-113`): odrzuca `null`, tę samą instancję i to samo id. Imienia nie sprawdza,
  - `getPet(Integer)` (`O:129-139`),
  - `getPet(String, boolean)` (`O:147-157`): **pierwsze** trafienie `equalsIgnoreCase` w kolejności listy,
  - `addVisit(petId, visit)` (`O:176-`): precedens metody intencji na agregacie.
- Brakuje: metody, która egzekwuje unikalność (dodanie lub zmiana imienia), jednego predykatu „inne zwierzę o tym imieniu” i wyniku albo wyjątku domenowego [I].

**Historia i intencjonalność**
- Brak warstwy serwisów jest **świadomy** [E]:
  - `83ff9a5` (2016, „Modularize and migrate to aggregate-oriented domain”) usunął `ClinicService`/`ClinicServiceImpl`,
  - `c953442` (2022): *„Owner is really the aggregate root in DDD terms and there is no need to directly access the Pet entity”*,
  - `4725753` (2022-01-06, Oliver Drotbohm): *„Introduced Owner.addVisit(…) to avoid that state transition to live in controller code”*.
- Logika duplikatu w kontrolerze (`3a61275`, `e0db9b1`) idzie wbrew temu kierunkowi.
- **Werdykt:** brak serwisu to **decyzja nośna**, do uszanowania. Reguła w kontrolerze to **przypadkowa złożoność** (pewność średnio-wysoka).
- Pozostałość: klasa `ClinicServiceTests` zachowała nazwę, choć testuje repozytoria (`@DataJpaTest`, `ClinicServiceTests.java:72-76`) [E].

**Wykonalność**
- Reuse agregatu, bez nowej warstwy: Branch by Abstraction. Dodać do `Owner` metodę zapytania lub intencji, przepiąć `PC:111` i `PC:151-155` po jednym wywołaniu, starą ścieżkę usunąć na końcu [I]. Serwis transakcyjny byłby nową abstrakcją sprzeczną z decyzją nośną, więc go nie proponuję.
- Osłony: testy kontrolera sprawdzają kontrakt HTTP (`attributeHasFieldErrorCode("pet","name","duplicate")`, widok, status), np. `PetControllerTests:218-229` [E]. Przetrwają przeniesienie reguły, jeśli kontroler dalej robi `rejectValue("name","duplicate")`. Naturalne miejsce na testy jednostkowe nowej metody to `owner/OwnerTests` [E, plik istnieje].
- Blast radius: `Owner` to hub (39 commitów, raport źródłowy §3.1). Dodanie metody jest addytywne. Kod `duplicate` i klucze w `messages*` zostają bez zmian.
- Blokery: brak. Koszt: **S**.

### C4. Sprawdzenie przy edycji zależy od odłączonych kopii

**Obecny kształt**
- `spring.jpa.open-in-view=false` (`application.properties:11`), dwa `findById` (`PC:69`, `PC:83`), `findPet` zwraca `owner.getPet(petId)` z drugiej kopii (`PC:86`), brak `@Transactional` w `PC` [E].
- Samo sprawdzenie porównuje po id (`PC:153`) [E]. Kruche jest to, że `getPet(name, false)` zwraca **pierwsze** trafienie (`O:147-157`) [E]. Przy jednej wspólnej instancji (OSIV albo transakcja wokół żądania) binding zmienia imię zwierzęcia na liście ownera, więc pierwsze trafienie może być samym edytowanym zwierzęciem z tym samym id. Wtedy błąd się nie pojawi, a duplikat trafi do P2 (na MySQL 500) [I].
- **Nowy fakt: test tego przypadku przechodzi dzięki kolejności w fixture [E].** Mock zwraca jedną instancję `Owner` dla obu odczytów (`PetControllerTests:86`). Zwierzęta są dodane w kolejności `petty` (id 1), potem `doggy` (id 2) (`:80-85`). `processUpdateFormWithDuplicateName` zmienia imię zwierzęcia 2 na „petty” (`:218-222`). Pętla w `O:148` trafia najpierw na zwierzę 1, więc błąd się pojawia. Przy odwrotnej kolejności dodania pętla trafiłaby najpierw na zwierzę 2 (po bindingu też „petty”), a test by padł [I, z kodu].
- [I] W produkcji z OSIV lista jest wczytywana w kolejności `@OrderBy("name")` (`O:69`) według imion sprzed bindingu. Błąd pojawiałby się więc, gdy imię edytowanego zwierzęcia sortuje się **po** imieniu docelowym, a nie pojawiałby się, gdy sortuje się **przed** nim.
- `OwnerRepository` ma tylko `findByLastNameStartingWith` (`:45`) i `findById` (`:60`) plus metody z `JpaRepository`. Nie ma zapytania o imię zwierzęcia ani `PetRepository` [E].

**Historia i intencjonalność**
- Historia przełączania OSIV [E]:
  1. `8805eaa` (2020-03-20): wyłączone, *„to remove warning on startup”*,
  2. `d381fb6` (2022-04-11): włączone z powrotem, *„Open session in view was switched off accidentally a while ago”*. Ten sam commit dodał `@ModelAttribute` `findPet` z drugim `findById`,
  3. `d90e284` (2024-09-24, PR #1667): wyłączone, *„it does not seems to be needed anymore, so we disable it to provide better performances”*.
- Sprawdzenie przy edycji powstało w `3a61275` (2023-07-11), czyli przy **włączonym** OSIV [E].
- **Werdykt:** `open-in-view=false` to **świadoma decyzja** (wydajność). To, że poprawność sprawdzenia zależy od odłączonych kopii i od kolejności listy, to **przypadkowa złożoność** [E dla chronologii, I dla skutku]. Że wyłączenie OSIV w 2024 przypadkiem naprawiło zachowanie z lat 2023–2024: [I], nieuruchamiane.

**Wykonalność**
- Docelowy kształt jest wspólny z C3: predykat „istnieje zwierzę o tym imieniu i innym id”, sprawdzany po **wszystkich** pasujących, a nie po pierwszym. Mieści się w metodzie agregatu z C3, bez zapytania do bazy i bez nowej abstrakcji [I]. Alternatywa z zapytaniem `exists` w `OwnerRepository` jest możliwa, ale niepotrzebna, bo wyścig i tak domyka ograniczenie w bazie [I].
- Osłony: żaden test nie złapie przełączenia OSIV ani dodania `@Transactional` [E, raport źródłowy D7].
- Blokery: brak (wystarczy H2). Koszt: **S**.

### C5. Bindery ownera i wizyty, zapis kaskadowy z pominięciem reguły

**Obecny kształt**
- Metody `@InitBinder` `OwnerController.setAllowedFields` (`:59-62`) i `VisitController.setAllowedFields` (`:51-54`) wołają wyłącznie `setDisallowedFields("id","*.id")`, więc ich nazwa myli [E].
- W całym repo jest 0 wywołań `setAllowedFields(` i 0 klas `*Dto`/`*Form` [E, grep].
- Zapisy `owners.save(owner)` (`OwnerController:84,168`, `VisitController:109`) idą kaskadą `CascadeType.ALL` na `pets` (`O:67`), a lista jest mutowalna (`O:96-98`) [E].
- [I, U-D9] `pets[0].name` w POST zmieni imię wczytanego zwierzęcia z pominięciem P1 i `PetValidator`. Kolizja da nieprzechwycony `DataIntegrityViolationException`, czyli 500 na każdej bazie (V1, V5).

**Historia i intencjonalność**
- `setDisallowedFields("id")` jest w repo od `521d01d` (2009) [E].
- `c7ee170` (2026-04-20, Dave Syer, *„Be more careful with allowed fields in binders”*, bez body i bez PR) dodał `"*.id"` i pierwszą blokadę dla bindera `pet` [E].
- W historii nie ma słów „mass assignment”, „security” ani „CVE” [E].
- **Werdykt: świadome ograniczenie w kierunku zawężania pól.** Pozostawienie `pets[…]` niezablokowanych wygląda na niedokończenie tego kierunku, a nie na decyzję [I]. Motywacja bezpieczeństwa jest niezapisana [U].

**Wykonalność**
- Reuse istniejącego `@InitBinder`: `setAllowedFields(...)` z polami formularza albo `setDisallowedFields` rozszerzone o `pets*`. To zmiana jednej linii na kontroler, odwracalna osobno [I]. DTO albo obiekt formularza byłby nieproporcjonalny.
- Ryzyko allow-listy: pominięcie pola, które formularz Thymeleaf naprawdę wysyła. Osłoną są istniejące testy `OwnerControllerTests` i `VisitControllerTests` (33 wywołania `param` w `OwnerControllerTests`, V18) [E].
- Osłony brakujące: żaden test nie wysyła `pets[…]` (V18) [E].
- Blokery: **U-D9** decyduje o pilności, nie o samej zmianie. Koszt: **S**.

### C6. Limit długości imienia zwierzęcia

**Obecny kształt**
- `MAX_NAME_LENGTH = 30` (`PetValidator.java:36`), `rejectValue("name","size",…)` (`:46-47`) [E].
- `NamedEntity.name` ma `@Column @NotBlank` bez `@Size` (`NamedEntity.java:33-35`) [E].
- Kolumny: H2 `VARCHAR_IGNORECASE(30)`, MySQL `VARCHAR(30)`, Postgres `TEXT` (S2) [E]. Sub-agent wykonalności podał „VARCHAR(30) we wszystkich trzech schematach”, co S2 obala. Poprawiłem.
- Ustalony wzorzec w innych encjach to `@Size` na polu encji [E]:
  - `Person.firstName`/`lastName`: `@Column(length = 30) @Size(max = 30) @NotBlank` (`model/Person.java:31-33,36-38`),
  - `Owner.address`/`city`: `@Size(max=255)`, `@Size(max=80)` (`O:52-60`),
  - `Visit.description`: `@Size(max=255)` (`Visit.java:43-45`).
- Klucza `size` nie ma w żadnym `messages*.properties` [E].

**Historia i intencjonalność**
- `80ff54a` (2015) zostawił w `PetValidator.java:25` komentarz *„We're not using Bean Validation annotations here because it is easier to define such validation rule in Java”* [E, sprawdzone].
- `676db04` (2026-08-11, PR #2611): *„reject pet names longer than 30 characters, matching the database column size”* [E].
- Wzorzec `@Size` ↔ kolumna wprowadzały punktowo `3c06fbf`, `f3c7483` i `3c7ab98`, a żaden nie dotknął `NamedEntity` [E].
- **Werdykt:** walidator zamiast adnotacji to **świadome ograniczenie**. Liczba 30 powtórzona ręcznie i `TEXT` w Postgresie to **przypadkowa złożoność** (seria poprawek na 500).

**Wykonalność**: dług tani. Brakujący klucz `size` to poprawka i18n (11 plików pilnowanych przez `I18nPropertiesSyncTest`), a nie zmiana struktury. Koszt: **S**. Blokerów brak.

### C7. Zarządzanie schematem bez narzędzia migracji

**Obecny kształt**
- `schema-locations=classpath*:db/${database}/schema.sql` (`application.properties:2-4`), `ddl-auto=none` (`:10`) [E].
- `spring.sql.init.mode=always` w `application-mysql.properties:7` i `application-postgres.properties:7` [E].
- Flyway i Liquibase: 0 w `pom.xml`, `build.gradle` i `src` [E, S7]. Infrastruktura testowa dla trzech baz już istnieje (`pom.xml:158-180`, `build.gradle:53-56`) [E].

**Historia i intencjonalność**
- `2c98a68` (2019) dodał komentarz *„SQL is written to be idempotent so this is safe”*, a `43beff9` (2022) wprowadził `CREATE TABLE IF NOT EXISTS` jako wzorzec [E]. Pickaxe `flyway` i `liquibase` na `--all`: 0 [E].
- **Werdykt:** idempotentny init przy każdym starcie to **świadome ograniczenie**. Brak narzędzia migracji to wybór niezapisany: **unknown**.

**Wykonalność**
- Flyway musi wejść równocześnie do `pom.xml` i `build.gradle`, z `flyway-mysql`, baseline dla istniejących baz i wyłączeniem `sql.init`. Trzy dialekty dalej oznaczają trzy zestawy skryptów, a dla H2 (`DROP` przy każdym starcie, `db/h2/schema.sql:5`) zysk jest zerowy [I].
- Koszt: **L**. Jedyna migracja potrzebna w tym obszarze (ograniczenie w starej bazie MySQL) da się opisać jako jednorazowy DDL [I]. Blokuje to **U-OLD**: czy istnieją wdrożenia, które trzeba migrować.

### C8. `Owner.getPet(String)` bez produkcyjnych wywołań

- `O:120-122` deleguje do `getPet(name, false)`. Produkcyjne jednoargumentowe wywołania (`PC:86`, `PC:189`, `VisitController:70`, `O:181`) przekazują id. Wywołania z `String` są tylko w testach: `OwnerControllerTests:102`, `PetClinicConcurrencyTests:51`, `ClinicServiceTests:181,311,312` [E, ast-grep + grep, zgodne z V9].
- Historia: produkcyjnych wywołań nie było nigdy (pickaxe w `src/main/java` od `521d01d`: 0) [E]. **Werdykt: przypadkowa złożoność o niskim ryzyku.**
- Wykonalność: S, blokerów brak. Zmiana dotknie 5 miejsc w testach.

### Niewiadome: co blokuje którego kandydata

| Niewiadoma | Blokuje | Krok-prerekwizyt, który ją rozstrzyga (bez uruchamiania w tej sesji) |
|---|---|---|
| **U1** komunikat i nazwa ograniczenia na MySQL | C1 (weryfikacja MySQL), C2 | test w `MySqlIntegrationTests`: dwa `saveAndFlush` z tym samym imieniem u jednego ownera, asercja pinująca obecny `getMessage()` i nazwę ograniczenia z łańcucha przyczyn. Ścieżkę P2 da się osiągnąć tylko przez repozytorium albo wyścig, bo P1 łapie duplikat wcześniej [I] |
| **U-PG** komunikat Postgresa | C1 (słabo), C2 | ten sam test w `PostgresIntegrationTests` |
| **U-VAR** warianty z akcentami i spacjami | C2 | sparametryzowany test repozytorium {„Leo”/„leo”, „Zoe”/„Zoë”, „Leo”/„Leo ”} × H2, MySQL, Postgres, pinujący dzisiejsze rozjechane zachowanie, a potem decyzja produktowa |
| **U-OLD** bazy sprzed `e0db9b1` | C1 (nazwanie ograniczenia w istniejących bazach), C2, C7 | inwentaryzacja wdrożeń (pytanie do właściciela produktu, nie test) i ewentualnie test startu na bazie z wersji sprzed `e0db9b1` |
| **U-D9** binding `pets[0].name` | pilność C5 (nie samą zmianę) | test `@WebMvcTest(OwnerController.class)` i `VisitController`: POST z `pets[0].name=<imię innego zwierzęcia>`, captor na `owners.save(...)` |
| Czy testy Dockerowe wykonują się w CI | osłony C1, C2 | odczyt logów ostatniego przebiegu Actions (liczba testów `MySqlIntegrationTests`/`PostgresIntegrationTests` w raporcie surefire) |

Żadna niewiadoma nie blokuje C3, C4, C6 ani C8.

## Refactor opportunities

Ocena: **koszt długu** (co dziś lub przy prawdopodobnej zmianie psuje się bez sygnału z CI) wobec **kosztu zmiany** (kod, testy, niewiadome, blast radius). Ranking to propozycja dla sesji planowania, a nie decyzja.

### #1. Reguła unikalności jako jedna metoda agregatu `Owner`, predykat po id (C3 + C4, z C8)

- **Obecny → docelowy kształt:**
  - dziś: dwa warianty sprawdzenia w kontrolerze (`PC:111`, `PC:151-155`) oparte na „pierwszym trafieniu” `getPet(name, flag)` (`O:147-157`), a poprawność edycji zależy od `open-in-view=false` i dwóch kopii,
  - cel: jedna metoda agregatu odpowiadająca na pytanie „czy imię jest zajęte przez **inne** zwierzę (id ≠ edytowane)”, sprawdzająca wszystkie pasujące wpisy. Kontroler tylko mapuje wynik na `rejectValue("name","duplicate")`. Bez warstwy serwisów, zgodnie z `83ff9a5`, `c953442` i `4725753`.
- **Dlaczego #1:**
  - koszt długu średni i ukryty: przełączenie OSIV albo dodanie transakcji cicho psuje sprawdzenie przy edycji, a jedyny test tego przypadku przechodzi dzięki kolejności w fixture (§C4) [E/I],
  - koszt zmiany najniższy: S, addytywna metoda, testy kontraktu HTTP zostają, **żadna niewiadoma nie blokuje**,
  - porządkuje grunt pod #2: po przeniesieniu reguły w kontrolerze zostaje mapowanie wyniku i obsługa wyjątku z bazy.
- **Blast radius:** `Owner.java` (hub, zmiana addytywna), `PC:111`, `PC:151-155`, `PetControllerTests` (fixture), `OwnerTests` (nowe testy). Bez zmian: `schema.sql`, `messages*`, szablony. Opcjonalnie `getPet(String)` (C8) i 5 miejsc w testach.
- **Szkic ścieżki, każdy krok odwracalny osobno:**
  1. Testy charakteryzujące.
  2. Nowa metoda w `Owner`, z testami jednostkowymi.
  3. Przepięcie edycji (`PC:151-155`).
  4. Przepięcie dodawania (`PC:111`).
  5. Usunięcie nieużywanych wariantów.
- **Pierwszy krok-prerekwizyt:**
  - testy w `OwnerTests` pinujące dzisiejszą semantykę `getPet(name, ignoreNew)`: wielkość liter, pomijanie nowych, pierwsze trafienie,
  - w `PetControllerTests` wariant fixture z **odwrotną kolejnością** zwierząt i wariant z **dwiema różnymi instancjami** `Owner` dla dwóch `findById` (`willReturn(Optional.of(a), Optional.of(b))`). Pierwszy obnaży zależność od kolejności, drugi odwzoruje produkcję,
  - opcjonalnie `@SpringBootTest` na H2 z `spring.jpa.open-in-view=true`, który zmienia imię na zajęte i oczekuje kodu `duplicate`.

### #2. Rozpoznanie naruszenia po nazwie ograniczenia, ograniczenie nazwane w trzech dialektach (C1)

- **Obecny → docelowy kształt:**
  - dziś: podnapis w komunikacie (`PC:202-205`), dwa identyczne `catch`, MySQL bez nazwy (`db/mysql/schema.sql:47`),
  - cel: jedno miejsce w kontrolerze rozpoznaje naruszenie po `ConstraintViolationException#getConstraintName()` z łańcucha przyczyn (albo po rodzaju `UNIQUE` i nazwie), ograniczenie ma tę samą nazwę w H2, Postgresie i MySQL, a test na prawdziwej bazie łączy komunikat sterownika z obsługą.
- **Dlaczego #2, a nie #1:**
  - koszt długu najwyższy w zestawieniu: na wspieranym profilu `mysql` wyścig albo wariant z akcentem najpewniej kończy się 500 zamiast błędu formularza [I, U1], a CI tego nie widzi (D1, D2, D4),
  - koszt zmiany wyższy niż #1: testy na dwóch silnikach w Dockerze, przepisanie dwóch testów z wymyślonym komunikatem, a weryfikację MySQL blokuje U1, nazwanie ograniczenia w istniejących bazach MySQL blokuje U-OLD (wymaga ręcznego DDL, bo brak narzędzia migracji, C7),
  - po #1 zmiana jest mniejsza: jeden blok obsługi zamiast dwóch.
- **Blast radius:** `PC:124-134`, `PC:167-176`, `PC:202-205`, `db/mysql/schema.sql:47` (i ewentualnie H2/Postgres dla spójnej nazwy), `PetControllerTests:166-176`, `:257-267`, `MySqlIntegrationTests`, `PostgresIntegrationTests`. `PetController` to plik z 52 commitami w historii (raport źródłowy §3.1).
- **Szkic ścieżki:**
  1. Testy charakteryzujące na prawdziwych bazach.
  2. Rozpoznanie po nazwie ograniczenia **obok** podnapisu (oba sygnały, Branch by Abstraction).
  3. Nazwanie ograniczenia w `db/mysql/schema.sql` dla nowych baz.
  4. Usunięcie podnapisu po zielonych testach na trzech bazach.
  5. Osobno: ręczny DDL dla istniejących baz MySQL, jeśli U-OLD potwierdzi, że takie są.
- **Pierwszy krok-prerekwizyt:** test w `MySqlIntegrationTests` i `PostgresIntegrationTests`, który wywołuje naruszenie przez `OwnerRepository.saveAndFlush` i pinuje dzisiejszy komunikat oraz nazwę ograniczenia z łańcucha przyczyn. To rozstrzyga U1 i U-PG. Do tego odczyt logów CI, czy te testy w ogóle się wykonują.

### #3. Allow-lista pól w binderach ownera i wizyty (C5)

- **Obecny → docelowy kształt:**
  - dziś: `setDisallowedFields("id","*.id")` (`OwnerController:61`, `VisitController:53`), a zapis kaskadowy obejmuje `pets`,
  - cel: bindery dopuszczają tylko pola, które wysyła formularz (allow-lista albo blokada `pets*`), więc zmiana imienia zwierzęcia jest możliwa tylko przez `PetController`.
- **Dlaczego #3:**
  - koszt zmiany najniższy (dwie linie, każda odwracalna osobno) i rozwija świadomy kierunek `c7ee170`,
  - koszt długu zależy od U-D9: jeśli binding działa, każde spreparowane żądanie omija `PetValidator` i regułę duplikatu, a kolizja daje 500 na każdej bazie [I]. Jeśli nie działa, zostaje sama defensywa,
  - jest niżej niż #1 i #2, bo dotyczy tylko spreparowanych żądań (formularze HTML nie mają pól `pets[…]`, raport źródłowy D9), a jej pilność jest [U].
- **Blast radius:** `OwnerController:59-62`, `VisitController:51-54`, `OwnerControllerTests`, `VisitControllerTests`. Ryzyko: pominięte pole formularza, które łapią istniejące testy z `param(...)` [E, V18].
- **Szkic ścieżki:**
  1. Test charakteryzujący.
  2. Zmiana bindera w `VisitController`.
  3. Zmiana bindera w `OwnerController`.
- **Pierwszy krok-prerekwizyt:** test MockMvc w `OwnerControllerTests` i `VisitControllerTests` z `pets[0].name=<imię innego zwierzęcia>` i captorem na `owners.save(...)`. Dziś pinuje zachowanie i rozstrzyga U-D9, a po zmianie staje się testem regresji.

### Rozważone i odrzucone

| Kandydat | Dlaczego poza rankingiem |
|---|---|
| **C2** reguła „to samo imię” w czterech implementacjach | Prawdziwa naprawa to zdefiniowanie relacji równoważności imion (akcenty, spacje, Unicode), czyli przeprojektowanie pojęcia biznesowego, a nie struktury kodu. Zatrzymuję się: to przedmiot osobnej, późniejszej analizy. Ignorowanie wielkości liter jest świadome (PR #2573). Prerekwizytem tej analizy jest macierz U-VAR. #2 nie zależy od tej decyzji |
| **C6** limit 30 znaków | Walidator zamiast `@Size` to świadomy wybór (`PetValidator.java:25`, `80ff54a`). To, co zostaje, czyli klucz `size` w `messages*` i ewentualnie `@Size(max=30)` na `Pet` zgodnie ze wzorcem `Person.java:31-33`, to tanie poprawki o małym koszcie długu, a nie refaktor struktury |
| **C7** narzędzie migracji | Koszt L (dwa buildy, trzy dialekty, baseline). Zysk w tym obszarze ogranicza się do jednego jednorazowego DDL, a idempotentny init jest świadomym wzorcem (`2c98a68`, `43beff9`). Do rozważenia jako osobna zmiana, jeśli U-OLD wykaże istniejące wdrożenia i kolejne zmiany schematu |
| **C8** `getPet(String)` tylko dla testów | Koszt długu bliski zeru. Do wchłonięcia przez #1 (krok 5) albo do pozostawienia |

## Weryfikacja twierdzeń (ast-grep)

Przeprowadzona 2026-11-23 na `939a56d`.
- **Java:** `ast-grep 0.51.3`, wyłącznie tryb wyszukiwania (`ast-grep run -l java -p '<wzorzec>'` i `ast-grep scan --inline-rules '<reguła>'`, bez `-r`, `-U` i `--interactive`).
- **SQL, `*.properties`, `pom.xml`, `build.gradle` i workflowy CI:** `grep -n`, bo ast-grep ich nie obsługuje.
- **Zera:** każde zero z ast-grep sprawdziłem grepem. **Realny brak** znaczy, że grep też nic nie znalazł. **Zły wzorzec** znaczy, że grep znalazł wystąpienie, więc wzorzec poprawiłem.
- **Wzorce samych adnotacji** (`@ControllerAdvice`, `@Service`, `@PrePersist`) zwalidowałem na adnotacjach, które istnieją: `@Controller` daje 6 trafień, `@Component` 1. Zero przy tych wzorcach nie wynika więc z wadliwego wzorca.
- Kod nie był zmieniany.

Werdykty: ✅ potwierdzone, 🔍 doprecyzowane, ❌ obalone. Kolumna „Kandydat” pokazuje, której pozycji rankingu twierdzenie dotyczy.

### Java

| # | Twierdzenie (kandydat) | Werdykt | Dowód (plik:linia) | Metoda (wzorzec / reguła; zero → grep) |
|---|---|---|---|---|
| W1 | `isDuplicatePetNameViolation` ma 2 wywołania o identycznym kształcie `if (!…(ex)) { throw ex; }` (C1, #2) | ✅ | `PC:129-131`, `PC:171-173` | `isDuplicatePetNameViolation($E)`: 2; `if (!isDuplicatePetNameViolation($E)) { throw $E; }`: 2 |
| W2 | Dwa bloki `try`/`catch (DataIntegrityViolationException)` w `src/main`, oba w `PC` (C1, C3) | ✅ | `PC:124-134`, `PC:167-176` (catch w `:128`, `:170`) | `try { $$$ } catch (DataIntegrityViolationException $E) { $$$ }`: 2 |
| W3 | Rozpoznanie nie przechodzi po łańcuchu przyczyn ani po SQLState (C1, #2) | ✅ | 0 w `PC` i 0 w `src/main` | `$X.getCause()` (w `PC`): 0; `$X.getSQLState()` (`src/main`): 0 → grep `getCause\|getSQLState`: 0, **realny brak** |
| W4 | W `src/main` brak `@ControllerAdvice`, `@RestControllerAdvice`, `@ExceptionHandler`, własnego `SQLExceptionTranslator` (C1) | ✅ | 0, 0, 0, 0 | `@ControllerAdvice`, `@RestControllerAdvice`, `@ExceptionHandler($$$)` → grep `ControllerAdvice\|ExceptionHandler\|SQLExceptionTranslator`: 0, **realny brak** |
| W5 | Dwa warianty sprawdzenia, nie kopie: dodawanie `getPet(…, true)` z `isNew()`, edycja `getPet(…, false)` + porównanie id (C3, #1) | ✅ | `PC:111` (`true`), `PC:152` (`false`), `PC:153` (`Objects.equals(…getId(), …getId())`) | `$O.getPet($N, true)`: 1; `$O.getPet($N, false)`: 1; `Objects.equals($A.getId(), $B.getId())`: 2 (patrz W6) |
| W6 | Agregat już porównuje zwierzęta po id: `addPet` odrzuca to samo id (C3, #1) | 🔍 | `O:108` `Objects.equals(existingPet.getId(), pet.getId())` | ten sam wzorzec co W5, drugie trafienie. **Doprecyzowanie:** predykat „inne zwierzę = inne id”, docelowy w #1, ma już precedens w agregacie |
| W7 | `PC` zależy od `OwnerRepository` i `PetTypeRepository` (`PC:53-60`) (C3) | ✅ | pola `PC:53`, `:55`, konstruktor `:57-60` | odczyt fragmentu (wzorzec niepotrzebny: dwa pola `final`) |
| W8 | W `src/main` 0 `@Service`. `@Transactional` tylko w `VetRepository.java:44,54` (C3, decyzja nośna) | ✅ | `VetRepository.java:44`, `:54` (`readOnly = true`) | `@Service`: 0; `@Transactional`: 0 (wariant bez argumentów); `@Transactional($$$)`: 2 → grep `@Service`: 0, `@Transactional`: te same 2 linie, **realny brak** |
| W9 | Metody `Owner`: `addPet` `:100-113`, `getPet(String)` `:120-122`, `getPet(Integer)` `:129-139`, `getPet(String, boolean)` `:147-157`, `addVisit` `:176-` (C3) | ✅ | dokładnie te zakresy, `addVisit` `:176-186`. Klasa ma łącznie 13 metod (6 getterów i setterów, `getPets` `:96-98`, `toString` `:159-169`) | reguła `kind: method_declaration` + `inside: class_body` w `Owner.java`: 13 |
| W10 | `getPet(String, boolean)` zwraca **pierwsze** trafienie (C4, #1) | ✅ | pętla `O:148-155`, `return pet;` w `:152` wewnątrz pętli, `return null;` w `:156` | `for (Pet $P : getPets()) { $$$ }`: 3 (`:107`, `:130`, `:148`); `return $P;`: trafienie `:152` |
| W11 | Dwa `findById` w `PC`, a `findPet` zwraca `owner.getPet(petId)` z drugiej kopii (C4) | ✅ | `PC:69`, `PC:83`, `PC:86` | `$R.findById($X)` w `PC`: 2; `return $O.getPet($ID);` w `PC`: 1 |
| W12 | Lista `pets`: `@OneToMany(cascade = ALL, fetch = EAGER)` (`O:67`), `@OrderBy("name")` (`O:69`), `getPets()` zwraca mutowalne pole (`O:96-98`) (C4, C5) | ✅ | `O:67`, `O:69`, `O:97` `return this.pets;` | `@OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER)`: 2 (drugie to `Pet.java:56`, wizyty); `@OrderBy("name")`: 1 |
| W13 | `OwnerRepository`: `extends JpaRepository` (`:36`), własne metody tylko `findByLastNameStartingWith` (`:45`) i `findById` (`:60`). Brak `PetRepository` (C4) | ✅ | `OwnerRepository.java:36`, `:45`, `:60`. W `owner/` są tylko `OwnerRepository.java` i `PetTypeRepository.java` | reguła `kind: method_declaration`: 2; `interface $I extends JpaRepository<$$$> { $$$ }`: 0, **zły wzorzec** (grep znajduje `:36`). Poprawiona reguła `kind: interface_declaration` + `has: extends_interfaces, regex: JpaRepository`: 1 |
| W14 | **Fixture testu edycji:** jeden `Owner` dla obu `findById` (`:86`), kolejność dodania `petty` (id 1), potem `doggy` (id 2) (`:80-85`). Test zmienia imię zwierzęcia `TEST_PET_ID + 1` na „petty” (`:218-222`) (C4, #1) | ✅ | `addPet`: `PetControllerTests:80` (`pet`), `:81` (`dog`); `setId`: `:82-83`; `setName`: `:84` „petty”, `:85` „doggy”; `given(…findById…)`: 1 (`:86`); POST z `TEST_PET_ID + 1`: `:220` | `$O.addPet($P)`: 2; `$P.setName($N)`: 3 (trzecie to `cat`, `:74`); `given($R.findById($I)).willReturn($$$)`: 1; `post("/owners/{ownerId}/pets/{petId}/edit", TEST_OWNER_ID, TEST_PET_ID + 1)`: 0, **zły wzorzec** (grep znajduje `:220`). Poprawiony `post($U, TEST_OWNER_ID, TEST_PET_ID + 1)`: 1 (`:220`) |
| W15 | Testy kontrolera podstawiają wymyślony komunikat w 2 miejscach (C1, koszt #2) | ✅ | `PetControllerTests:167-168`, `:258-259` (testy `:166`, `:257`) | `$G.willThrow(new DataIntegrityViolationException($M))`: 2 |
| W16 | Bindery `setDisallowedFields("id", "*.id")`: 4 miejsca. 0 wywołań `setAllowedFields(`. Metody `@InitBinder` w ownerze i wizycie nazywają się `setAllowedFields` (C5, #3) | ✅ | `OwnerController:61`, `VisitController:53`, `PC:91` (binder `owner`), `PC:97` (binder `pet`). Definicje `void setAllowedFields`: `OwnerController:60`, `VisitController:52` | `$B.setDisallowedFields($$$)`: 4; `$B.setAllowedFields($$$)`: 0 → grep `setAllowedFields(` bez definicji metod: 0, **realny brak** |
| W17 | **Zakres C5:** zapisy kaskadowe bez sprawdzenia duplikatu tylko w `OwnerController` i `VisitController` (#3) | 🔍 | zapisy: `save` `OwnerController:84`, `:168`, `VisitController:109`; `saveAndFlush` `PC:126`, `:199`. **Handlery POST w `PC` przyjmują `Owner owner` bez adnotacji** (`PC:107` `processCreationForm(Owner owner, @Valid Pet pet, …)`, `PC:144` `processUpdateForm(Owner owner, @Valid Pet pet, …)`). Taki parametr wiąże się jako atrybut modelu przez binder `owner` (`PC:89-92`), który blokuje tylko `id` i `*.id` (`PC:91`) | `$R.save($X)`: 3; `$R.saveAndFlush($X)`: 2; reguła `kind: method_declaration` + `has: modifiers > annotation regex ^@PostMapping` w `owner/`: 5 handlerów (`VisitController:97`, `PC:107`, `PC:144`, `OwnerController:77`, `:153`) |
| W18 | Brak DTO i obiektów formularza (C5) | ✅ | 0 klas `*Dto`/`*DTO`/`*Form` | reguła `kind: class_declaration` + `has: {field: name, regex: "(Dto\|DTO\|Form)$"}`: 0. Ta sama reguła z `regex: "Controller$"` daje 6, więc reguła jest poprawna → grep `class \w*(Dto\|DTO\|Form)`: 0, **realny brak** |
| W19 | Żaden test nie wysyła `pets[…]`. W `OwnerControllerTests` jest 33 wywołań `param` (C5) | ✅ | 33 trafienia (`OwnerControllerTests:117-275`), żaden klucz nie zaczyna się od `pets` | `$X.param($K, $$$)` w `OwnerControllerTests`: 33 → grep `"pets\[` w `src/test`: 0, **realny brak** |
| W20 | Brak normalizacji imienia: `NamedEntity.setName` to przypisanie, brak `@PrePersist`/`@PreUpdate`, `StringTrimmerEditor`, `registerCustomEditor`, `trim()`. Jedyne `strip()` w `OwnerController:103` (C2) | ✅ | `NamedEntity.java:41-43` (`this.name = name;`), `OwnerController:103` | `public void setName($T $N) { $$$ }`: 1; `@PrePersist`: 0; `@PreUpdate`: 0; `new StringTrimmerEditor($$$)` w `src`: 0; `$B.registerCustomEditor($$$)`: 0; `$X.trim()`: 0; `$X.strip()`: 1 → grep `PrePersist\|PreUpdate\|registerCustomEditor\|\.trim()` w `src/main`: 0, `StringTrimmerEditor` w `src`: 0, **realny brak** |
| W21 | `NamedEntity` dziedziczą `Pet`, `PetType`, `Specialty` (C2, C6) | ✅ | `Pet.java:46`, `PetType.java:28`, `Specialty.java:30` (ast-grep raportuje początek deklaracji z adnotacjami: `:44`, `:26`, `:28`) | reguła `kind: class_declaration` + `has: {kind: superclass, regex: NamedEntity}`: 3; grep `extends NamedEntity`: 3 |
| W22 | Limit 30 tylko w `PetValidator` (`:36`, kod `size` w `:46-47`). `NamedEntity.name` ma `@NotBlank` bez `@Size` (C6) | ✅ | `PetValidator.java:36`, `:47`; `NamedEntity.java:34` | reguła `kind: field_declaration` + `regex: MAX_NAME_LENGTH`: 1; `$R.rejectValue("name", "size", $$$)`: 1; `@NotBlank` w `NamedEntity`: 1 |
| W23 | Wzorzec `@Size` na encjach: `Person` (`:31-33`, `:36-38`), `Owner` (`:52-60`), `Visit` (`:43-45`); `@Column(length)` tylko w `Person` (C6) | ✅ | `@Size`: `Person.java:32`, `:37`, `Owner.java:54`, `:59`, `Visit.java:44` (5); `@Column(length = 30)`: `Person.java:31`, `:36` (2) | reguła `kind: annotation` + `regex: ^@Size`: 5; `@Column(length = $L)`: 2 |
| W24 | `getPet(String)` bez produkcyjnych wywołań. Produkcyjne wywołania jednoargumentowe przekazują id: `PC:86`, `PC:189`, `VisitController:70`, `O:181`. Wywołania z `String` tylko w 5 miejscach w testach (C8) | ✅ | prod: `VisitController:70`, `PC:86`, `PC:189` + wewnętrzne `O:181`. Testy z `String`: `PetClinicConcurrencyTests:51`, `ClinicServiceTests:181`, `:311`, `:312`, `OwnerControllerTests:102` (5). Pozostałe 4 testowe trafienia to `getPet(7)` | `$O.getPet($X)` w `src/main`: 3; `getPet($X)` w `Owner.java`: 1; `$O.getPet($X)` w `src/test`: 9 (5 × `String`, 4 × liczba) |
| W25 | `PetTypeFormatter` jako `@Component` (`:36-37`), jedyny w `src/main` (C2) | ✅ | `PetTypeFormatter.java:36-37` | `@Component`: 1 |
| W26 | Testy na prawdziwej bazie: `ClinicServiceTests` `@DataJpaTest` (`:72-76`), MySQL `@Testcontainers(disabledWithoutDocker = true)` (`:43`), Postgres `assumeTrue` (C1, osłony #2) | 🔍 | `ClinicServiceTests:72` (+ `Replace.NONE` `:74`), `MySqlIntegrationTests:43`, `PostgresIntegrationTests:68` (raport: `:50-53`). Linie `:51-52` to właściwości docker compose w `@SpringBootTest` | `@DataJpaTest`: 1; `@Testcontainers($$$)`: 1; `assumeTrue($$$)`: 1 (`:68`). Poprawione w miejscu w §C1 i w „Code References” |

### SQL, konfiguracja, build i CI (grep)

| # | Twierdzenie (kandydat) | Werdykt | Dowód (plik:linia) | Metoda |
|---|---|---|---|---|
| G1 | Nazwa `unique_owner_pet_name` tylko w H2 i Postgresie. MySQL ma nienazwane `UNIQUE (owner_id, name)` (C1) | ✅ | `db/h2/schema.sql:55`, `db/postgres/schema.sql:45`, `db/mysql/schema.sql:47` | `grep -n "unique_owner_pet_name\|UNIQUE" db/*/schema.sql`. Pozostałe `UNIQUE` (`mysql:19`, `postgres:17`) dotyczą `vet_specialties` |
| G2 | Typ `pets.name`: H2 `VARCHAR_IGNORECASE(30)` `:48`, MySQL `VARCHAR(30)` `:40`, Postgres `TEXT` `:38` (C2, C6) | ✅ | jak w twierdzeniu | `grep -n` po `schema.sql` |
| G3 | Tworzenie `pets`: H2 `DROP` `:5` + `CREATE TABLE` `:46`; MySQL `CREATE TABLE IF NOT EXISTS` `:38` z ograniczeniem w środku `:47`; Postgres `CREATE TABLE IF NOT EXISTS` `:36` + osobny indeks `:45` (C1, C7) | ✅ | jak w twierdzeniu | `grep -n "CREATE TABLE.*pets\|DROP TABLE pets"` |
| G4 | Schemat MySQL bez `COLLATE` i `CHARSET` (C2) | ✅ | 0 | `grep -ci "collate\|charset" db/mysql/schema.sql`: 0 |
| G5 | `schema-locations` `application.properties:2-4`, `ddl-auto=none` `:10`, `open-in-view=false` `:11`, `sql.init.mode=always` w `application-{mysql,postgres}.properties:7` (C4, C7) | ✅ | jak w twierdzeniu | `grep -n` |
| G6 | Flyway i Liquibase: 0 w `pom.xml` i `build.gradle` (C7) | ✅ | 0 i 0 | `grep -ci "flyway\|liquibase"` |
| G7 | CI: `./mvnw -B verify` (`maven-build.yml:29`), `./gradlew build` (`gradle-build.yml:31`), `deploy-and-test-cluster.yml` tylko dla `k8s/**` (`:6-11`) | ✅ | jak w twierdzeniu; raport podaje zakresy `:28-29`, `:30-31` (krok + `run`) | `grep -n "mvnw\|gradlew\|paths\|k8s"` |
| G8 | JaCoCo bez progu: tylko `prepare-agent` i `report` (`pom.xml:276-296`) | ✅ | `<goal>prepare-agent` `:283`, `<goal>report` `:289`; `<goal>check` w zakresie `:276-296`: 0 (pozostałe `check` w `:238` to checkstyle, a w `:398` profil natywny) | `grep -n "<goal>"`, `sed -n 276,296p \| grep -c "<goal>check"`: 0 |
| G9 | Infrastruktura testowa baz: `pom.xml:158-180` (testcontainers, docker-compose), `build.gradle:53-56`; Boot 4.1.0 (`pom.xml:7-8`) (C1, C7) | ✅ | `spring-boot-testcontainers`, `spring-boot-docker-compose`, `testcontainers-junit-jupiter`, `testcontainers-mysql` w obu plikach | `sed -n` + `grep artifactId` |

### Poza zasięgiem narzędzi

- Twierdzenia o bibliotekach (`ConstraintViolationException#getConstraintName()` w hibernate-core 7.4.1, `HibernateExceptionTranslator` w spring-orm 7.0.8) dotyczą jarów, a nie kodu repo. ast-grep ich nie sprawdzi, więc zostają z oznaczeniem z §C1.
- Liczby commitów (52 dla `PC`, 39 dla `Owner`) i cytaty z historii pochodzą z gita, nie ze struktury kodu. Poza zakresem tej weryfikacji.

### Co weryfikacja zmieniła

- **Obalonych twierdzeń: 0.** Zera z ast-grep okazały się złymi wzorcami 2 razy (W13, W14): grep znalazł wystąpienia, a poprawione wzorce dały ten sam wynik co grep. Pozostałe zera to realny brak.
- **Poprawka w miejscu:** linie `PostgresIntegrationTests` to `:51-52` i `:68` (raport: `:50-53`). Ślad korekty jest w §C1 i w „Code References”.
- **Doprecyzowanie W6 (dotyczy #1):** `Owner.addPet` już porównuje zwierzęta po id (`O:108`). Predykat docelowy w #1 ma więc precedens w agregacie. Pozycji to nie zmienia.
- **Doprecyzowanie W17 (dotyczy #3 i #1). Do decyzji na etapie planowania.**
  - Opis C5 i pozycja #3 obejmują bindery `OwnerController:61` i `VisitController:53`. Weryfikacja pokazuje trzeci binder z tą samą listą: `PC:89-92`. Wiąże on parametr `Owner owner` handlerów `PC:107` i `PC:144` [E].
  - [I, zależne od U-D9] Jeśli binding indeksowanej listy `pets[0].name` działa, to w `PetController` spreparowane żądanie zmienia imiona na liście `owner.getPets()`, a na tej liście opiera się sprawdzenie w pamięci (`PC:111`, `PC:152`). Zapisuje ją potem `saveAndFlush(owner)` (`PC:126`, `PC:199`).
  - Skutki dla planowania:
    - blast radius #3 może obejmować także `PC:89-92`,
    - krok-prerekwizyt #3 (test z `pets[0].name`) warto rozszerzyć o `POST /owners/{id}/pets/new` i `…/pets/{petId}/edit`,
    - wynik tego testu dotyczy też założenia #1, że lista ownera zawiera imiona z bazy.
  - Kolejności rankingu weryfikacja nie przesądza.

## Code References

- `owner/PetController.java:69,83,86`: dwa `findById`, `findPet` z drugiej kopii
- `owner/PetController.java:111`, `:151-155`: dwa warianty sprawdzenia duplikatu
- `owner/PetController.java:124-134`, `:167-176`, `:202-205`: obsługa P2 i rozpoznanie po napisie
- `owner/Owner.java:67-70`: kaskada, EAGER, `@OrderBy("name")`
- `owner/Owner.java:100-113`, `:120-122`, `:129-139`, `:147-157`, `:176-`: `addPet`, `getPet(String)`, `getPet(Integer)`, `getPet(String, boolean)`, `addVisit`
- `owner/OwnerController.java:59-62`, `:84`, `:168`; `owner/VisitController.java:51-54`, `:109`: bindery i zapisy kaskadowe
- `owner/OwnerRepository.java:36`, `:45`, `:60`: metody repozytorium
- `owner/PetValidator.java:25`, `:36`, `:46-47`: uzasadnienie walidatora, limit 30, kod `size`
- `model/NamedEntity.java:33-35`, `:41-43`; `model/Person.java:31-33`: wzorzec `@Size` i jego brak
- `application.properties:2-4`, `:10-11`; `application-{mysql,postgres}.properties:7`
- `db/h2/schema.sql:5,48,55`; `db/mysql/schema.sql:38-48`; `db/postgres/schema.sql:38,45`
- `src/test/.../owner/PetControllerTests.java:77-86` (fixture: kolejność `petty`, `doggy`; jeden `Owner`), `:166-176`, `:218-229`, `:257-267`
- `.github/workflows/maven-build.yml:28-29`, `gradle-build.yml:30-31`, `deploy-and-test-cluster.yml:3-31` (tylko zmiany `k8s/**`)
- `src/test/.../MySqlIntegrationTests.java:43-50`, `PostgresIntegrationTests.java:51-52`, `:68` (raport: `:50-53`)

## Architecture Insights

- Projekt świadomie trzyma się modelu „agregat `Owner` + repozytorium, bez serwisów” (`83ff9a5`, `c953442`, `4725753`). Każdy kierunek refaktoru, który dokłada warstwę serwisów, idzie wbrew decyzji nośnej. Docelowe kształty w rankingu mieszczą się w istniejących abstrakcjach: agregat, `@InitBinder`, łańcuch przyczyn wyjątku.
- Dług w tym obszarze ma wspólny wzorzec: reguły dopisywane w kontrolerze lub w SQL przez kolejne PR-y bez review (PR #2573: 0 komentarzy), w okresach z innym ustawieniem infrastruktury (OSIV 2022–2024). Poprawność zależy od ustawień, których kod nie wyraża.
- CI uruchamia te same testy dwa razy (Maven i Gradle) i bez progu pokrycia (`pom.xml:276-296`: tylko `prepare-agent` i `report`) [E]. Osłony dla #1 i #3 można zbudować na H2 i MockMvc, a dla #2 potrzebne są testy Dockerowe, których wykonywanie w CI to [U].

## Historical Context (from prior changes)

- `context/changes/pet-duplicate-name-analysis/research.md`: źródło D1–D9, V1–V18, S1–S7, U1 i pytań 1–5. Wszystkie twierdzenia przejęte stamtąd zachowały swoje oznaczenia. Jedna korekta przy przejęciu: kolumna Postgresa to `TEXT`, a nie `VARCHAR(30)` (S2).
- `context/archive/`: brak wcześniejszych zmian.

## Related Research

- `context/changes/pet-duplicate-name-analysis/research.md`
- `context/map/repo-map.md` (strefy 1, 2 i 3)

## Open Questions

1. U1, U-PG, U-VAR, U-OLD i U-D9: kroki-prerekwizyty w tabeli „Niewiadome”. Żadna nie blokuje #1.
2. Czy testy `MySqlIntegrationTests` i `PostgresIntegrationTests` wykonują się w CI, czy są pomijane po cichu (brak logów Actions).
3. Czy Spring 7.0.8 tłumaczy duplikat na `DuplicateKeyException` i czy `ViolatedConstraintNameExtractor` zwraca nazwę ograniczenia dla H2 i MySQL. Rozstrzygnie to test z kroku-prerekwizytu #2.
4. Jaka relacja równoważności imion obowiązuje w produkcie (C2). To pytanie do osobnej analizy pojęć biznesowych.
