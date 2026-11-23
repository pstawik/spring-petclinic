---
date: 2026-11-23T09:05:42+01:00
researcher: Claude Opus 5.5 (sesja Piotr S)
git_commit: d508ed7
branch: main
repository: spring-petclinic
topic: "Zapis zwierzęcia ze zdublowanym imieniem u tego samego właściciela (dodawanie i edycja)"
tags: [research, owner, PetController, schema, unique_owner_pet_name, strefa-3]
status: complete
last_updated: 2026-11-23
last_updated_by: Claude Opus 5.5 (sesja Piotr S)
last_updated_note: "Weryfikacja twierdzeń strukturalnych przez ast-grep 0.51.3 (Java) i grep (SQL). Doprecyzowano D8, dodano D9 (zapisy z pominięciem sprawdzenia duplikatu), dodano sekcję 'Weryfikacja strukturalna'."
---

# Research: zapis zwierzęcia ze zdublowanym imieniem u tego samego właściciela

**Date**: 2026-11-23T09:05:42+01:00
**Researcher**: Claude Opus 5.5 (sesja Piotr S)
**Git Commit**: `d508ed7` (kod produktu bez zmian od `500158f`, 2026-09-29)
**Branch**: main
**Repository**: spring-petclinic

Ścieżki Java są względem `src/main/java/org/springframework/samples/petclinic/` (`PC` = `owner/PetController.java`), a zasoby względem `src/main/resources/`. Testy leżą pod `src/test/java/org/springframework/samples/petclinic/`.

Oznaczenia:
- **[E] evidence**: przeczytane w kodzie, w historii gita, w raporcie JaCoCo albo w logu surefire,
- **[I] inference**: wniosek z kodu albo ze znanego zachowania bazy lub frameworka, nieuruchomiony,
- **[U] unknown**: nie da się rozstrzygnąć bez uruchomienia. Przy każdym podaję, jak to sprawdzić.

Niczego nie uruchamiano. Bazy danych, buildy i testy nie były startowane, a kod nie był zmieniany. Dane o pokryciu pochodzą z raportu JaCoCo i z logów surefire z 2026-11-20 (`target/`). Raport odpowiada dzisiejszemu kodowi: ostatnia zmiana w `src/` to `500158f`, a `git status src` jest pusty.

## Research Question

Jak przebiega zapis zwierzęcia z imieniem, które ma już inne zwierzę tego samego właściciela, przy dodawaniu i przy edycji? Kiedy kończy się błędem w formularzu, a kiedy stroną błędu? Co trzeba zmieniać razem z tym przepływem? Które niewiadome U1–U4 ze strefy ryzyka 3 w `context/map/repo-map.md` się potwierdzają?

## Summary

- **Reguła działa w dwóch warstwach.**
  - **P1, sprawdzenie w pamięci przed zapisem** (`PC:111`, `PC:151-155`, `Owner.java:147-157`, `equalsIgnoreCase`) daje błąd `duplicate` w formularzu i HTTP 200 na każdej bazie [E].
  - **P2, ograniczenie w bazie** łapie duplikat, który przeszedł P1. Tak dzieje się przy równoczesnych żądaniach (check-then-act) i przy różnicach w porównywaniu napisów między Javą a bazą. Wyjątek trafia do `PC:128-134` albo `PC:170-176`. O zamianie na błąd formularza decyduje w obu blokach `catch` wyłącznie test podnapisu `unique_owner_pet_name` w komunikacie wyjątku (`PC:202-205`) [E].
- **Wynik P2 zależy od bazy.**
  - **H2:** komunikat zawiera nazwę ograniczenia, więc użytkownik dostaje formularz z błędem. Prawdziwy komunikat jest w logu surefire testu współbieżności [E].
  - **Postgres:** najpewniej tak samo jak H2 [I].
  - **MySQL:** ograniczenie nie ma nazwy (`db/mysql/schema.sql:47`). Komunikat najpewniej nie zawiera tego napisu, więc kontroler rzuca wyjątek dalej i użytkownik dostaje stronę błędu 500 (`templates/error.html`) [I, U1].
- **MySQL może trafić do P2 także przy pojedynczym żądaniu.** Porównanie napisów w MySQL zależy od collation serwera, a repo jej nie ustawia: `db/mysql/user.sql` nie jest niczym uruchamiany, a katalog `conf.d` montowany w `docker-compose.yml:12-13` nie istnieje [E]. Przy domyślnej collation, która ignoruje akcenty, „Zoe” i „Zoë” przechodzą sprawdzenie w Javie, ale zderzają się w bazie i dają 500 [I].
- **Testy nie łączą prawdziwego komunikatu bazy z obsługą w kontrolerze.**
  - Oba testy ścieżki P2 w kontrolerze podstawiają wymyślony komunikat (`PetControllerTests:167-168`, `:258-259`) [E].
  - Test współbieżności działa tylko na H2 i nie odróżnia błędu w formularzu od 500 (`PetClinicConcurrencyTests:86-95`) [E].
  - Z 10 niepokrytych gałęzi `PetController` 5 leży na tej ścieżce. Szósta (`PC:111`, `isNew()==false`) jest nieosiągalna przez HTTP [E + I].
- **Ciasny klaster zmian:** `PetController`, trzy `schema.sql` i trzy klasy testów. W historii zmieniły się razem tylko w jednym commicie (`e0db9b1`) [E]. Pozostałe powiązania to huby (`Owner`, `messages*`) albo ukryte sprzężenia, których żaden check w CI nie łapie.
- **Uzupełnienie po weryfikacji ast-grep:** w `src/main` jest 5 wywołań zapisu przez `OwnerRepository` [E]. Sprawdzenie duplikatu poprzedza tylko 2 z nich, oba w `PetController` (`PC:126`, `PC:199`). Pozostałe 3 (`OwnerController:84`, `:168`, `VisitController:109`) zapisują ownera z kaskadą na zwierzęta. Ich bindery blokują tylko `id` i `*.id`, więc najpewniej da się przez nie zmienić imię zwierzęcia parametrem `pets[0].name` z pominięciem P1 i bez obsługi wyjątku, czyli z błędem 500 na każdej bazie [I, D9]. Szczegóły w sekcji „Weryfikacja strukturalna”.

## Detailed Findings

### 1. Feature overview

#### 1.1 Przygotowanie żądania (wspólne dla dodawania i edycji)

- Metody `@ModelAttribute` uruchamiają się w kolejności `populatePetTypes` (`PC:62-65`), `findOwner` (`PC:67-73`, `owners.findById`), `findPet` (`PC:75-87`) [E]:
  - przy dodawaniu `findPet` zwraca `new Pet()` (`PC:79-81`),
  - przy edycji **drugi raz** woła `owners.findById` (`PC:83`) i potem `owner.getPet(petId)` (`PC:86`).
- `@InitBinder("pet")` ustawia `new PetValidator()` i blokuje pola `id` i `*.id` (`PC:94-98`) [E]. Id zwierzęcia pochodzi więc tylko z `findPet`, a nie z ukrytego pola formularza.
  - [I] `setValidator` zastępuje domyślny walidator Bean Validation, więc `@NotBlank` z `NamedEntity.java:33-35` nie działa na tym formularzu. Jego zadanie przejmuje `PetValidator` (`:43`).
- **OSIV jest wyłączone:** `spring.jpa.open-in-view=false` (`application.properties:11`) [E]. Kontroler nie ma transakcji, a każde `findById` działa we własnym, krótkim kontekście persystencji.
  - [I] Przy edycji `owner` (z `findOwner`) i `pet` (z drugiego `findById`) są **osobnymi, odłączonymi kopiami**. Binding zmienia kopię `pet`, a lista `owner.getPets()` zachowuje imiona zapisane w bazie.
  - Na tym opiera się poprawność sprawdzenia `PC:151-155`, opisana w 2.3.

#### 1.2 P1: duplikat wykryty w pamięci, przed zapisem

**Dodawanie (`POST /owners/{ownerId}/pets/new`):**
1. Binding i `PetValidator.validate` (`owner/PetValidator.java:39-59`). Sprawdza: imię niepuste (`:43`), co najwyżej 30 znaków (`:36`, `:46`), typ wymagany dla nowego zwierzęcia (`:51`), data urodzenia wymagana (`:56`) [E].
2. `PC:111` sprawdza `hasText(name) && pet.isNew() && owner.getPet(name, true) != null`. `Owner.getPet(String, boolean)` (`Owner.java:147-157`) przechodzi po zwierzętach właściciela z `equalsIgnoreCase` (`:150`) i pomija niezapisane (`:151`) [E].
3. Przy trafieniu wywołuje `rejectValue("name", "duplicate", "already exists")` (`PC:112`), potem `hasErrors` i zwraca widok `pets/createOrUpdatePetForm` (`PC:120-121`, `PC:51`) z HTTP 200 [E].
4. Widok: `inputField.html:19` (`th:errors`) rozwiązuje kod `duplicate` do `messages.properties:4` („is already in use”). Klucz jest w 10 z 11 plików, a `messages_en.properties` jest celowo pusty i korzysta z pliku bazowego [E].

**Edycja (`POST /owners/{ownerId}/pets/{petId}/edit`):**
1. Binding trafia na odłączoną kopię `pet`, z zachowanym id. Walidator nie wymaga typu, bo zwierzę nie jest nowe (`PetValidator.java:51`) [E].
2. `PC:151-155`: `owner.getPet(petName, false)` szuka w kopii `owner` z imionami z bazy. Jeśli znajdzie zwierzę o **innym** id (`Objects.equals`, `PC:153`), zgłasza błąd `duplicate` [E].
3. [I] Zmiana tego samego zwierzęcia tylko w wielkości liter („leo” na „Leo”) znajduje je samo, więc przechodzi bez błędu. Tak powinno być.

#### 1.3 P2: duplikat wykryty dopiero przez bazę

**Dodawanie:**
1. Dwa równoczesne POST-y przechodzą `PC:111`, bo żaden z dwóch odczytów ownera nie zawiera zwierzęcia z drugiego żądania [I].
2. `owner.addPet(pet)` (`PC:125`, `Owner.java:100-113`), potem `owners.saveAndFlush(owner)` (`PC:126`) [E]. W `SimpleJpaRepository.saveAndFlush`, który jest `@Transactional`, wykonuje się `em.merge(owner)` z kaskadą `CascadeType.ALL` (`Owner.java:67`) i flush [E, źródła spring-data-jpa 4.1.0].
3. Baza odrzuca wiersz. Spring tłumaczy wyjątek Hibernate'a na `DataIntegrityViolationException` z komunikatem `ex.getMessage() + "; SQL [...]; constraint [<nazwa>]"` (`HibernateExceptionTranslator.java:167-169`, spring-orm 7.0.8) [E]. Transakcja jest wycofywana.
4. `PC:129`, `isDuplicatePetNameViolation` (`PC:202-205`):
   - **prawda:** błąd `duplicate` i formularz z HTTP 200,
   - **fałsz:** `throw ex` (`PC:130`).
5. Ponowny rzut: w `src/main` nie ma `@ControllerAdvice` ani `@ExceptionHandler` [E, przeszukane]. Spring Boot pokazuje `templates/error.html` ze statusem 500 i tekstem `#{error.500}` (`error.html:13`, `messages.properties:51`) [E].
   - [I] `${message}` (`error.html:18`) jest najpewniej pusty, bo nikt nie ustawia `server.error.include-message`.

**Edycja:**
1. Dwie równoczesne zmiany na to samo imię, albo zmiana równoległa do dodania, przechodzą `PC:151-155` [I].
2. `updatePetDetails` (`PC:186-200`) kopiuje imię, datę i typ na zwierzę z listy ownera (`PC:192-194`), potem `saveAndFlush` (`PC:199`). Dalej jak przy dodawaniu, kroki 3–5 (`PC:170-176`) [E].
   - [I] Gałąź else (`PC:196-197`, `owner.addPet`) wykonuje się tylko, gdy zwierzę zniknęło między dwoma odczytami.

**Prawdziwe komunikaty po bazach:**

| Baza | Ograniczenie | Komunikat w P2 | Wynik dla użytkownika |
|---|---|---|---|
| H2 | `ALTER TABLE pets ADD CONSTRAINT unique_owner_pet_name UNIQUE (owner_id, name)` (`db/h2/schema.sql:55`) | [E] w logu surefire `PetClinicConcurrencyTests` (2026-11-20): `"PUBLIC.UNIQUE_OWNER_PET_NAME INDEX PUBLIC.UNIQUE_OWNER_PET_NAME_INDEX_2 ON PUBLIC.PETS(...)"`. Tekst wokół był po polsku (locale JVM), ale nazwa ograniczenia się nie zmienia | formularz z błędem [E: log nie ma żadnej linii `ERROR`] |
| Postgres | `CREATE UNIQUE INDEX IF NOT EXISTS unique_owner_pet_name ON pets (owner_id, LOWER(name))` (`db/postgres/schema.sql:45`) | [I] `duplicate key value violates unique constraint "unique_owner_pet_name"` | formularz z błędem [I] |
| MySQL | nienazwane `UNIQUE (owner_id, name)` w `CREATE TABLE IF NOT EXISTS pets` (`db/mysql/schema.sql:38-48`) | [I] MySQL nadaje nienazwanemu kluczowi nazwę pierwszej kolumny, np. `Duplicate entry '1-leo' for key 'pets.owner_id'`, i dopisuje `constraint [owner_id]`. Nie ma tam `unique_owner_pet_name` | **strona błędu 500** [I, U1] |

#### 1.4 Diagram

```mermaid
sequenceDiagram
  participant B as Przeglądarka
  participant C as PetController
  participant R as OwnerRepository (proxy)
  participant H as Hibernate / baza
  B->>C: POST /owners/{o}/pets/new | /pets/{p}/edit
  C->>R: findById(o) [findOwner :69]
  R-->>C: odłączona kopia Owner A
  C->>R: findById(o) [findPet :83, tylko edycja]
  R-->>C: odłączona kopia Owner B, pet = B.getPet(p)
  C->>C: binding (bez id) + PetValidator
  C->>C: P1: A.getPet(name, ignoreNew), equalsIgnoreCase [:111 / :151-155]
  alt duplikat w P1
    C-->>B: 200, formularz z błędem "duplicate"
  else przechodzi
    C->>R: saveAndFlush(A) [:126 / :199] (@Transactional)
    R->>H: merge + flush (INSERT / UPDATE)
    alt naruszenie UNIQUE (P2)
      H-->>R: ConstraintViolationException
      R-->>C: DataIntegrityViolationException(msg + "; constraint [x]")
      alt msg zawiera "unique_owner_pet_name" (H2 [E], Postgres [I])
        C-->>B: 200, formularz z błędem "duplicate"
      else MySQL: klucz "owner_id" [I]
        C-->>B: 500, error.html
      end
    else zapis OK
      C-->>B: 302 redirect:/owners/{o} + flash
    end
  end
```

#### 1.5 Porównywanie napisów: Java a trzy bazy

Każda warstwa ma własną implementację reguły „to samo imię”:

| Warstwa | Wielkość liter | Akcenty | Spacje na końcu | Źródło |
|---|---|---|---|---|
| Java (P1) | ignoruje (`equalsIgnoreCase`) | rozróżnia | rozróżnia, nic nie przycina | `Owner.java:150` [E]. W `src/main` jedyne `strip()` jest w wyszukiwaniu nazwiska (`OwnerController.java:103`) i nie ma `StringTrimmerEditor` [E] |
| H2 | ignoruje (`VARCHAR_IGNORECASE(30)`) | rozróżnia [I] | [U] | `db/h2/schema.sql:48` |
| Postgres | ignoruje (`LOWER(name)` w indeksie) | rozróżnia [I] | rozróżnia [I] | `db/postgres/schema.sql:45` |
| MySQL | zależy od collation serwera, repo jej nie ustawia | domyślnie `utf8mb4_0900_ai_ci` ignoruje akcenty [I] | `0900_ai_ci` to NO PAD i rozróżnia [I]. Ręczne `utf8_general_ci` z `user.sql` to PAD SPACE i nie rozróżnia [I] | `db/mysql/schema.sql:40`, `db/mysql/user.sql:3-5` (nic go nie uruchamia [E]), `docker-compose.yml:12-13` montuje nieistniejący `./conf.d` [E] |

- [I] Skutek: na MySQL pojedyncze żądanie „Zoë” przy istniejącym „Zoe” przechodzi P1 i trafia do P2, a P2 kończy się na MySQL błędem 500. Przy ręcznej konfiguracji z `user.sql` to samo dotyczy „Leo ” i „Leo”.
- [I] Na H2 i Postgresie „Leo ” i „Leo” zapiszą się jako dwa różne zwierzęta, które dla użytkownika wyglądają jak duplikat.

### 2. Technical debt

Rodzaje sprzężeń nazywam według connascence. „Statyczne” znaczy widoczne w kodzie źródłowym, „dynamiczne” znaczy ujawniające się dopiero w runtime. **Dług prawdziwy** to taki, którego rozjazd nie zostanie złapany przez CI (`./mvnw -B verify`, `./gradlew build`). **Tani** to taki, który CI złapie.

#### 2.1 Dług prawdziwy (CI tego nie łapie)

| # | Sprzężenie | Connascence | Dowód | Dlaczego CI tego nie złapie |
|---|---|---|---|---|
| D1 | `PC:204` ↔ nazwa ograniczenia w `db/h2/schema.sql:55` i `db/postgres/schema.sql:45` | **nazwy, dynamiczne**: napis dopasowany do komunikatu sterownika w runtime | [E] napis występuje w kodzie tylko w tych 3 miejscach i w `PetControllerTests:168,259` | testy kontrolera mają własną kopię napisu, więc zmiana nazwy w SQL nadal przechodzi. Test współbieżności liczy 500 jako „porażkę” (D4). Nic nie zauważy, że błąd formularza zamienił się w stronę błędu |
| D2 | `PC:204` ↔ MySQL (`db/mysql/schema.sql:47`) | **nazwy, dynamiczne**, już rozjechane: ograniczenie nie ma nazwy | [E] brak nazwy; [I] wynik 500 | `MySqlIntegrationTests` sprawdza tylko `findAll` i `ownerDetails` [E] |
| D3 | `equalsIgnoreCase` (`Owner.java:150`) ↔ `VARCHAR_IGNORECASE` ↔ `LOWER(name)` ↔ collation MySQL | **algorytmu / znaczenia, dynamiczne** po stronie bazy: ta sama reguła w czterech implementacjach | [E] §1.5 | tylko H2 ma test bazy (`ClinicServiceTests:255`, sprawdza „DuplicatePetName” wobec „duplicatepetname”) [E]. Collation MySQL nie jest ustawiana w repo |
| D4 | `PetClinicConcurrencyTests:86-95` ↔ wynik P2 | **znaczenia, dynamiczne**: test traktuje „błąd w formularzu” i „wyjątek lub 500” jako to samo | [E] wyjątek RestTemplate trafia do `catch` (`:94`) i jest liczony jako `failureCount` | test przejdzie także wtedy, gdy obsługa P2 przestanie działać |
| D5 | Limit 30 znaków: `PetValidator.java:36` ↔ `VARCHAR(30)` (H2, MySQL) ↔ `TEXT` (Postgres) ↔ brak `@Size` w `NamedEntity.java:33-35` | **wartości, statyczne wartości wymuszane w runtime** | [E] | żaden test nie porównuje walidatora ze schematem. Kod `size` (`PetValidator.java:47`) **nie ma klucza w żadnym `messages*.properties`** [E], więc zawsze pokazuje się angielski tekst domyślny, a `I18nPropertiesSyncTest` nie sprawdza literałów w Javie |
| D6 | Istniejące bazy ↔ treść `schema.sql` | **znaczenia, dynamiczne**: brak narzędzia migracji (brak Flyway i Liquibase w `pom.xml` i `build.gradle`, `ddl-auto=none`, `sql.init.mode=always` w `application-{mysql,postgres}.properties:7`) [E] | [I] MySQL: baza sprzed `e0db9b1` bez ręcznego `ALTER TABLE` nie dostanie ograniczenia (jest wewnątrz `CREATE TABLE IF NOT EXISTS`), więc wyścig zapisze duplikat bez błędu. [I] Postgres: indeks powstanie przy starcie, ale jeśli w bazie już są duplikaty, `CREATE UNIQUE INDEX` padnie i aplikacja się nie uruchomi (`continue-on-error` nieustawione) | testy integracyjne zawsze startują na czystej bazie |
| D7 | Poprawność `PC:151-155` ↔ `spring.jpa.open-in-view=false` (`application.properties:11`) | **wykonania (timing / tożsamość obiektu), dynamiczne** | [E] ustawienie; [I] przy OSIV albo przy serwisie z `@Transactional` wokół kontrolera oba `findById` zwrócą ten sam obiekt, binding zmieni imię na liście ownera przed sprawdzeniem i `getPet(newName)` może znaleźć samo edytowane zwierzę. Duplikat przejdzie do P2, a na MySQL skończy się 500 | `PetControllerTests` używa mocka, który **zwraca ten sam obiekt `Owner` przy obu wywołaniach** (`PetControllerTests:86`). Testy symulują więc właśnie wariant z OSIV i nie wykryją zmiany konfiguracji w żadną stronę |
| D8 | Reguła domenowa w kontrolerze | **algorytmu, statyczne**. Dwa bloki `catch` (`PC:128-134`, `PC:170-176`) mają identyczny kształt: ast-grep znajduje dokładnie 2 trafienia wzorca `if (!isDuplicatePetNameViolation($E)) { throw $E; }` (`PC:129`, `PC:171`). Dwa sprawdzenia w pamięci **nie są** kopiami. Dodawanie używa `getPet(name, true)` z `isNew()` (`PC:111`), a edycja `getPet(name, false)` z porównaniem id (`PC:152-153`). To dwa warianty tej samej reguły | [E] ast-grep, patrz V3, V6 | kompilator i formatowanie tego nie widzą. Regułę zna jedna osoba (autor `e0db9b1`, wg T3) |
| D9 | Lista dozwolonych pól bindera ↔ graf encji `Owner → pets` | **znaczenia, dynamiczne**: o tym, czy żądanie może zmienić imię zwierzęcia, decyduje lista `setDisallowedFields("id", "*.id")` (`OwnerController:61`, `VisitController:53`), a nie ścieżka w kodzie | [E] 5 wywołań `save`/`saveAndFlush` w `src/main` (V7). Sprawdzenie duplikatu poprzedza tylko `PC:126` i `PC:199`. `OwnerController:84` (nowy owner), `:168` (edycja ownera, owner wczytany w `:67`) i `VisitController:109` (owner z `model.put("owner", …)`, `:76`) zapisują ownera z `CascadeType.ALL` (`Owner.java:67`). `@Valid Owner` nie waliduje zwierząt, bo lista `pets` nie ma `@Valid` (`Owner.java:67-70`). [I] Parametr `pets[0].name` w `POST /owners/{id}/edit` albo w `POST …/visits/new` zmieni imię wczytanego zwierzęcia z pominięciem P1 i `PetValidator`. Naruszenie unikalności skończy się wtedy błędem 500 na każdej bazie, bo te kontrolery nie łapią `DataIntegrityViolationException` (V1). Na MySQL bez ograniczenia (D6) duplikat zapisze się bez błędu | żaden test nie wysyła parametru `pets[…]` (grep `"pets\[` w `src/test`: 0 trafień, V18). Formularze HTML takiego pola nie mają, więc to dotyczy tylko spreparowanych żądań |

#### 2.2 Dług tani (CI złapie rozjazd)

| Sprzężenie | Connascence | Co łapie |
|---|---|---|
| Kod błędu `duplicate` w `PC:112,132,154,174` ↔ klucz w 10 plikach `messages*` | nazwy, dynamiczne | `I18nPropertiesSyncTest` pilnuje, żeby klucz był we wszystkich plikach. Brak klucza w pliku bazowym nie złamie widoku, bo jest tekst domyślny „already exists” |
| Tekst „is already in use” (`messages.properties:4`) ↔ `PetClinicConcurrencyTests:86` | wartości, dynamiczne | zmiana tekstu rozstroi liczenie w teście. Test najpewniej padnie na `successCount == 1` (na H2) |
| Składnia trzech `schema.sql` | typu / składni | start kontekstu w testach H2 i w `MySqlIntegrationTests` i `PostgresIntegrationTests` (te dwa wymagają Dockera) |
| `PetController` ↔ `OwnerRepository`, `PetTypeRepository`, `PetValidator` | typu, statyczne | kompilator. Ce = 6, Ca = 0 (`context/map/evidence/jdeps/coupling-metrics.md:24`) |

#### 2.3 Luki w testach

**Testy na tej ścieżce:**

| Test | Ścieżka | Co sprawdza | Mock czy prawdziwa baza |
|---|---|---|---|
| `owner/PetControllerTests.java:124` `processCreationFormWithDuplicateName` | P1, dodawanie (`PC:111`) | widok formularza, kod `duplicate` na `name`, 200 | mock (`@WebMvcTest`, `@MockitoBean OwnerRepository`) |
| `PetControllerTests.java:166` `processCreationFormWithDataIntegrityViolation` | P2, dodawanie (`PC:128-134`, `PC:204` = prawda) | jak wyżej | **mock z wymyślonym komunikatem** `"Duplicate key: unique_owner_pet_name"` (`:167-168`) |
| `PetControllerTests.java:218` `processUpdateFormWithDuplicateName` | P1, edycja: zwierzę 2 przemianowane na imię zwierzęcia 1 | kod `duplicate` | mock |
| `PetControllerTests.java:202` `processUpdateFormWithSameName` | edycja z tym samym imieniem, bez błędu | redirect | mock |
| `PetControllerTests.java:257` `processUpdateFormWithDataIntegrityViolation` | P2, edycja (`PC:170-176`) | kod `duplicate` | **mock z tym samym wymyślonym komunikatem** (`:258-259`) |
| `service/ClinicServiceTests.java:255` `shouldFailToInsertDuplicatePetNameForSameOwner` | repozytorium, bez kontrolera; wielkość liter | tylko typ wyjątku (`assertThrows(DataIntegrityViolationException.class, …)`) | prawdziwe H2. Komunikat z nazwą ograniczenia jest w logu, ale test go nie sprawdza [E] |
| `ClinicServiceTests.java:281` `shouldAllowSamePetNameForDifferentOwners` | repozytorium | to samo imię u dwóch ownerów jest dozwolone | prawdziwe H2 |
| `PetClinicConcurrencyTests.java:41` | P1 albo P2, dodawanie, 2 wątki po HTTP | `successCount == 1`, liczba zwierząt +1, jedno zwierzę z tym imieniem (`:124-131`) | prawdziwe H2, profil domyślny |
| `MySqlIntegrationTests`, `PostgresIntegrationTests` | – | `findAll`, `ownerDetails` | prawdziwe bazy, **bez duplikatu** |

- `owner/PetValidatorTests.java:128` sprawdza imię z 31 znaków (`"A".repeat(31)`) [E]. To test walidatora bez kontrolera i bez bazy, więc nie dotyczy duplikatów.

**Niepokryte gałęzie `PetController` (JaCoCo z 2026-11-20: 10 pominiętych z 38 gałęzi):**

| Linia | Warunek | Brakująca strona | Na ścieżce duplikatu? |
|---|---|---|---|
| `PC:111` | `… && pet.isNew() && …` | `isNew() == false` | tak, ale [I] nieosiągalne przez HTTP (`findPet` zwraca `new Pet()`, a `id` jest zablokowane) |
| `PC:116` | data urodzenia przy dodawaniu | `birthDate == null` | nie |
| `PC:129` | `!isDuplicatePetNameViolation(ex)` (dodawanie) | prawda, czyli `throw ex` | **tak** |
| `PC:153` | `existingPet != null && …` | `existingPet == null` | **tak** |
| `PC:159` | data urodzenia przy edycji | `isAfter == true` | nie |
| `PC:171` | `!isDuplicatePetNameViolation(ex)` (edycja) | prawda, czyli `throw ex` | **tak** |
| `PC:188` | `Assert.state(id != null)` | `id == null` | nie |
| `PC:190` | `existingPet != null` w `updatePetDetails` | gałąź else, `owner.addPet` | nie |
| `PC:204` | `message != null && contains(...)` (2 gałęzie) | `message == null` oraz `contains == false` | **tak, obie** |

- Na ścieżce duplikatu leży więc **5 z 10** niepokrytych gałęzi (`PC:129`, `:153`, `:171` i dwie z `:204`), plus `PC:111`, której nie da się osiągnąć przez HTTP [E + I].
- [I] Gałąź `PC:153` (`existingPet == null`) w produkcji wykonuje się przy każdej zmianie imienia na takie, którego nikt nie ma, bo `owner` i `pet` to osobne kopie (§1.1). W przebiegu testów z 2026-11-20 nie wykonała się ani razu (JaCoCo), bo mock zwraca jeden obiekt (`PetControllerTests:86`) i wyszukiwanie zawsze znajduje samo edytowane zwierzę. **Pokrycie JaCoCo nie odpowiada więc produkcyjnemu przebiegowi tej linii.**

**Czego żaden test nie robi** [E, w zakresie przejrzanych testów]:
- nie sprawdza prawdziwego komunikatu bazy w `isDuplicatePetNameViolation`,
- nie uruchamia ponownego rzutu wyjątku przy innym naruszeniu integralności (`PC:130`, `PC:172`),
- nie wywołuje duplikatu na profilu `mysql` ani `postgres`,
- nie testuje kolizji przy edycji na prawdziwej bazie ani równoczesnej edycji,
- nie wysyła wariantów różniących się wielkością liter, akcentem ani spacjami przez kontroler.

### 3. Blast radius

#### 3.1 Co zmienia się razem

| Artefakt | Miejsce | Powód | Para ciasna czy hub | Historia `[git]` |
|---|---|---|---|---|
| `PetController` | `PC:111`, `:151-155`, `:128-134`, `:170-176`, `:202-205` | reguła i rozpoznanie napisu | **ciasna** z SQL i testami | 52 commity w całej historii, 4 w oknie |
| `db/h2/schema.sql` | `:48`, `:55` | nazwa i reguła wielkości liter | ciasna | 13 / 1 |
| `db/mysql/schema.sql` | `:38-48` | ograniczenie (bez nazwy) | ciasna, ale rozjechana | 9 / 1 |
| `db/postgres/schema.sql` | `:38`, `:45` | nazwa, `LOWER`, `TEXT` | ciasna | 5 / 2 (`e0db9b1`, `88e37c1`) |
| `PetControllerTests`, `ClinicServiceTests`, `PetClinicConcurrencyTests` | §2.3 | kopie napisu i tekstu, testy reguły | ciasna | 33 / 4, 52 / 2, 1 / 1 |
| `Owner.getPet(String, boolean)` | `Owner.java:147-157` | sprawdzenie w pamięci | metoda ciasna, klasa `Owner` to **hub** (39 / 4, w oknie m.in. jspecify, snake_case, długości pól) | ostatnia zmiana logiki duplikatu: `3a61275` (2023) |
| `PetValidator`, `NamedEntity` | `PetValidator.java:36,46`; `NamedEntity.java:33-35` | limit długości | luźna (`676db04` zmienił tylko walidator) | 19 / 1, 17 / 3 |
| `messages*.properties` (11 plików) | klucz `duplicate` | tekst błędu | **hub** (15 commitów, żaden dla tej reguły) | 15 / 3 |
| `templates/pets/createOrUpdatePetForm.html`, `fragments/inputField.html` | `:20`, `:19` | pokazanie błędu pola | luźna | 8 / 0 |
| `db/*/data.sql` | `:36-48` | dane startowe. Dziś brak kolizji u jednego ownera, także bez względu na wielkość liter („Lucky” mają ownerzy 7 i 10) [E] | brak współzmian | 0 w oknie |

Dla porównania: okno ma 47 commitów bez filtrów, a mapa liczy 28 po filtrach (T1).

#### 3.2 Fakty o współzmianach `[git]`

- `e0db9b1` (2026-07-14, „Enforce unique pet names per owner”) zmienił 7 plików: `PetController` (+32), trzy `schema.sql`, `PetClinicConcurrencyTests` (nowy, +134), `PetControllerTests` (+35), `ClinicServiceTests` (+64). Nie dotknął `Owner`, `Pet`, `PetValidator`, `messages*` ani szablonu, bo sprawdzenie w pamięci i kod `duplicate` są w repo od `3a61275` (2023-07-11) [E].
- `88e37c1` (2026-07-22) zmienił tylko `db/postgres/schema.sql`: dodał `IF NOT EXISTS` i jawne nazwy wszystkich 7 indeksów, 8 dni po `e0db9b1` [E].
- **Trzy `schema.sql` w jednym commicie:** 2 razy w całej historii (`b559077` z 2022 i `e0db9b1`), w oknie tylko `e0db9b1` [E].
- **`schema.sql` razem z `PetController`:** w obecnym układzie plików tylko `e0db9b1`, czyli 1 z 52 commitów `PetController` [E]. Starsze `9f8acc0` i `14f8822` (2013, migracja na JPA i formatowanie) nie dotyczą tej reguły.
- `git log -S unique_owner_pet_name` znajduje w kodzie tylko `e0db9b1`. Pozostałe 4 trafienia to dokumenty mapy [E].

#### 3.3 Co trzeba zmienić przy typowych zmianach [I]

- **Zmiana nazwy ograniczenia:** 2 pliki SQL (H2 i Postgres) + `PC:204` + `PetControllerTests:168,259` + ręczny DDL dla istniejących baz. Na Postgresie nowy indeks powstanie obok starego, a stary nie zostanie usunięty.
- **Nazwanie ograniczenia w MySQL:** `db/mysql/schema.sql:47`. Istniejące bazy MySQL go nie dostaną, bo zmienia się wnętrze `CREATE TABLE IF NOT EXISTS` (D6).
- **Przeniesienie reguły z kontrolera:** dwa sprawdzenia w pamięci i dwa bloki `catch`. Testy kontrolera sprawdzają kod `duplicate` na `BindingResult`, więc trzeba je przenieść razem z regułą.
- **Nowe pole w kluczu unikalności:** `Pet.java`, `Owner.getPet`, trzy `schema.sql`, trzy `data.sql` (w H2 i MySQL `INSERT … VALUES` bez listy kolumn, czyli connascence pozycji), szablon formularza i komunikaty w 10 plikach.

## Code References

- `owner/PetController.java:75-87`: `findPet`, drugie `findById` przy edycji
- `owner/PetController.java:94-98`: `PetValidator` i zablokowane `id`
- `owner/PetController.java:111-113`: P1 przy dodawaniu
- `owner/PetController.java:124-134`: P2 przy dodawaniu
- `owner/PetController.java:151-155`: P1 przy edycji
- `owner/PetController.java:167-176`, `:186-200`: P2 przy edycji, `updatePetDetails`
- `owner/PetController.java:202-205`: rozpoznanie naruszenia po napisie
- `owner/Owner.java:67-70`: `@OneToMany(cascade = ALL, fetch = EAGER)`, `@OrderBy("name")`
- `owner/Owner.java:100-113`, `:129-139`, `:147-157`: `addPet`, `getPet(Integer)`, `getPet(String, boolean)`
- `owner/PetValidator.java:36-59`: imię, długość 30, typ, data
- `model/NamedEntity.java:33-35`: `name` z `@NotBlank`, bez `@Size`
- `src/main/resources/application.properties:11`: `spring.jpa.open-in-view=false`
- `src/main/resources/db/h2/schema.sql:48,55`; `db/mysql/schema.sql:38-48`; `db/postgres/schema.sql:38,45`
- `src/main/resources/db/mysql/user.sql:3-5`: `utf8_general_ci`, nieuruchamiany automatycznie
- `docker-compose.yml:12-13`: montowanie nieistniejącego `./conf.d`
- `src/main/resources/templates/fragments/inputField.html:19`; `templates/error.html:13,18`; `messages/messages.properties:4,51`
- `src/test/java/.../owner/PetControllerTests.java:86` (jeden obiekt `Owner` z mocka), `:124`, `:166-168`, `:202`, `:218`, `:257-259`
- `src/test/java/.../service/ClinicServiceTests.java:255`, `:281`
- `src/test/java/.../PetClinicConcurrencyTests.java:86-95`, `:124-131`
- `target/surefire-reports/TEST-org.springframework.samples.petclinic.PetClinicConcurrencyTests.xml`: prawdziwy komunikat H2 z `UNIQUE_OWNER_PET_NAME` (przebieg z 2026-11-20)

## Architecture Insights

- Reguła „unikalne imię u ownera” ma dwie linie obrony: sprawdzenie w pamięci w kontrolerze i ograniczenie w bazie. Ich połączenie to jeden napis porównywany z komunikatem sterownika. Na H2 to działa, na Postgresie najpewniej też, a na MySQL najpewniej nie.
- Brak warstwy serwisowej i transakcji w kontrolerze sprawia, że `owner` i `pet` są osobnymi kopiami. Sprawdzenie przy edycji jest dziś poprawne tylko dzięki temu. Dodanie transakcji albo włączenie OSIV zmieni jego znaczenie bez żadnej zmiany w samym kodzie sprawdzenia.
- Testy kontrolera modelują inny wariant niż produkcja: mock zwraca ten sam obiekt dla obu odczytów. Pokrycie gałęzi w `PC:153` nie mówi więc nic o zachowaniu produkcyjnym.

## Historical Context (from prior changes)

- Nie dotyczy: `context/changes/` i `context/archive/` nie zawierają wcześniejszych zmian poza tą. Jedynym kontekstem jest mapa w `context/map/`.

## Related Research

- `context/map/repo-map.md` (strefa 3, „Pierwszy dzień” pkt 4–5, „Ograniczenia”)
- `context/map/artifact-2-structure.md` (§1.5, §7), `context/map/evidence/jdeps/unknowns.md` (U24, U26)

## Korekty względem mapy

Każde założenie oceniam osobno: ✅ potwierdzone, ⚠️ częściowo, ❌ nieaktualne lub błędne.

| Założenie z `repo-map.md` | Werdykt | Uzasadnienie |
|---|---|---|
| `isDuplicatePetNameViolation` sprawdza `contains("unique_owner_pet_name")` w `PetController.java:204` | ✅ | `PC:202-205` [E] |
| Nazwę `unique_owner_pet_name` mają tylko H2 i Postgres, a MySQL ma nienazwane `UNIQUE (owner_id, name)` | ✅ | `db/h2/schema.sql:55`, `db/postgres/schema.sql:45`, `db/mysql/schema.sql:47` [E] |
| U1: na MySQL duplikat z bazy najpewniej daje stronę błędu | ⚠️ wzmocnione, nadal [U] | brak nazwy [E], brak `@ControllerAdvice` [E], format komunikatu Springa (`HibernateExceptionTranslator.java:167-169`) [E]. Treść komunikatu MySQL to [I]. Nowe ustalenie: MySQL trafia do P2 także przy **pojedynczym** żądaniu, jeśli imiona różnią się akcentem (§1.5) |
| U2: powiązanie kontroler ↔ schemat istnieje tylko jako napis, poza grafem jdeps | ✅ | `PC:204` to literał. `git log -S` znajduje w kodzie tylko `e0db9b1` [E] |
| U3: wnioski o bazach nie były uruchamiane na MySQL i Postgresie | ✅ (dla MySQL i Postgresa) / ❌ (dla H2) | dla H2 jest dowód z przebiegu: log surefire `PetClinicConcurrencyTests` pokazuje prawdziwy komunikat z nazwą ograniczenia i brak `ERROR` [E]. MySQL i Postgres nadal nieuruchamiane z duplikatem |
| U4: JaCoCo 28/38 mierzy wykonanie, a testy podstawiają wymyślony komunikat | ✅ | 28/38 potwierdzone w `jacoco.xml` [E], wymyślony komunikat w `PetControllerTests:168,259` [E]. Dodatkowo: pokrycie `PC:153` nie odzwierciedla produkcji, bo mock zwraca jeden obiekt `Owner` (§2.3) |
| `PetClinicConcurrencyTests` działa na domyślnym H2 | ✅ | [E]. Dodatkowo test nie odróżnia błędu formularza od 500 (D4) |
| `ClinicServiceTests.shouldFailToInsertDuplicatePetNameForSameOwner` sprawdza tylko typ wyjątku | ✅ | `ClinicServiceTests:255` [E] |
| MySQL ignoruje wielkość liter „przez collation bazy `utf8_general_ci` ustawianą w `db/mysql/user.sql`” | ❌ | `user.sql` nie jest uruchamiany przez żaden plik kodu ani konfiguracji. `docker-compose.yml` i Testcontainers tworzą bazę z domyślną collation serwera (`mysql:9.7`), a montowany `./conf.d` nie istnieje [E]. Faktyczna collation to [U] |
| Kaskadę na prawdziwej bazie sprawdza tylko `ClinicServiceTests`, tylko na H2 | ⚠️ | także `PetClinicConcurrencyTests` zapisuje przez kaskadę po HTTP na prawdziwym H2 [E] |
| Granice wejścia są „zamknięte”, a limit imienia zwierzęcia ma test `PetValidatorTests` (31 znaków) | ⚠️ | test jest (`owner/PetValidatorTests.java:128`) [E]. Ale kod błędu `size` (`PetValidator.java:47`) nie ma klucza w żadnym `messages*.properties`, więc komunikat nie jest tłumaczony, a Postgres (`TEXT`) i `NamedEntity` (brak `@Size`) nie wymuszają limitu poza formularzem [E] |
| Regułę zna jedna osoba (autor `e0db9b1`) | ✅ (bez zmian) | `e0db9b1` to jedyny commit kodu z tym napisem [E]. Sprawdzenie w pamięci jest starsze (`3a61275`, 2023) |
| Binder `setDisallowedFields("id", "*.id")` „w 3 kontrolerach” (sekcja 3 mapy, `c7ee170`) | ⚠️ doprecyzowane | 3 kontrolery, 4 wywołania: `PC:91`, `PC:97`, `OwnerController:61`, `VisitController:53` (V14). Lista nie blokuje pól zwierząt w formularzu ownera ani wizyty (D9) |
| Brak nowej kolumny w istniejących bazach MySQL i Postgres (sekcja 3 mapy) | ⚠️ rozszerzone | dla tej reguły skutki są różne: MySQL sprzed `e0db9b1` bez ręcznego `ALTER TABLE` nie dostanie ograniczenia, a Postgres doda indeks i może nie wystartować przy istniejących duplikatach (D6) [I] |

## Open Questions

Każda pozycja wymaga uruchomienia, a nie tylko odczytu kodu:

1. **[U1] Komunikat MySQL i wynik P2.** `docker compose up mysql`, potem `SHOW CREATE TABLE pets` (nazwa klucza) i `SELECT @@collation_database`. Następnie `PetClinicConcurrencyTests` z `@ActiveProfiles("mysql")` (Testcontainers) albo dwa równoczesne `POST /owners/1/pets/new` z tym samym imieniem. Formularz z „is already in use” obala ryzyko, strona błędu 500 je potwierdza. Trzeba zalogować `ex.getMessage()`.
2. **Komunikat Postgresa.** To samo na profilu `postgres`. Oczekiwany wynik [I]: `violates unique constraint "unique_owner_pet_name"`.
3. **Collation MySQL i warianty napisów.** Pojedyncze `POST` z „Zoë” przy istniejącym „Zoe”, a potem z „Leo ” przy istniejącym „Leo”, na MySQL, H2 i Postgresie.
4. **Istniejące bazy.** Uruchomić profil `mysql` i `postgres` na bazie utworzonej z wersji sprzed `e0db9b1`. Sprawdzić, czy ograniczenie powstało i czy aplikacja startuje przy istniejących duplikatach.
5. **[D9] Zmiana imienia zwierzęcia z pominięciem P1.** Test `@WebMvcTest(OwnerController.class)`: `POST /owners/1/edit` z poprawnymi polami ownera i `pets[0].name=<imię drugiego zwierzęcia>`, potem przechwycić argument `owners.save(...)` i sprawdzić, czy imię się zmieniło. To samo dla `POST /owners/1/pets/1/visits/new` (`VisitController`). Na uruchomionej aplikacji: ten sam `curl` i sprawdzenie statusu (500 potwierdza brak obsługi). Wynik pokaże też, czy Spring 7 dopuszcza binding indeksowanej listy bez settera.

## Weryfikacja strukturalna (ast-grep + grep)

Przeprowadzona 2026-11-23 na `d508ed7`. Twierdzenia o Javie: `ast-grep 0.51.3`, wyłącznie tryb wyszukiwania (`ast-grep run -l java -p '<wzorzec>'` i `ast-grep scan --inline-rules '<reguła>'`, bez `-r`, `-U` i `--interactive`). Twierdzenia o SQL: `grep -n` w każdym z trzech dialektów, bo ast-grep nie obsługuje SQL. Każde zero z ast-grep sprawdziłem grepem: **realny brak** znaczy, że grep też nic nie znalazł, a **zły wzorzec** znaczy, że grep znalazł wystąpienia i wzorzec poprawiłem. Kod nie był zmieniany.

Werdykty: ✅ potwierdzone, 🔍 doprecyzowane, ❌ obalone.

### Java

| # | Twierdzenie z raportu | Werdykt | Wynik (pliki i linie) | Wzorzec ast-grep | Zero → grep |
|---|---|---|---|---|---|
| V1 | `DataIntegrityViolationException` jest łapany w 2 miejscach, oba w `PetController` | ✅ | 2: `PC:124` (try) / `:128` (catch), `PC:167` / `:170`. Typ występuje w `src/main` 3 razy: `PC:128`, `:170`, `:202` (parametr `isDuplicatePetNameViolation`). W `src/test` brak `catch` | `try { $$$ } catch (DataIntegrityViolationException $E) { $$$ }`; reguła `kind: catch_clause` + `has: type_identifier ^DataIntegrityViolationException$`; reguła `kind: type_identifier` | wzorzec `catch (DataIntegrityViolationException $E) { $$$ }` dał 0, to **zły wzorzec** (sam `catch` bez `try` nie jest kompletnym węzłem). Grep `catch (DataIntegrityViolationException` zwraca 2: `PC:128`, `PC:170` |
| V2 | Napis `unique_owner_pet_name` jest w Javie produkcyjnej tylko w `PC:204`, a w testach w `PetControllerTests:168,259` | ✅ | literał `"unique_owner_pet_name"`: 1 (`PC:204`). Literały zawierające napis: 3 (`PC:204`, `PetControllerTests:168`, `:259`). Wywołanie `.contains(...)` z tym napisem: 1 (`PC:204`) | `"unique_owner_pet_name"`; `$S.contains("unique_owner_pet_name")`; reguła `kind: string_literal` + `regex: unique_owner_pet_name` | grep po `*.java` zwraca te same 3 linie |
| V3 | `isDuplicatePetNameViolation` ma 2 wywołania o identycznym kształcie | ✅ | 2: `PC:129`, `PC:171`, oba jako `if (!isDuplicatePetNameViolation(ex)) { throw ex; }` | `isDuplicatePetNameViolation($E)`; `if (!isDuplicatePetNameViolation($E)) { throw $E; }` | – |
| V4 | Kod błędu `duplicate` jest zgłaszany w 4 miejscach (`PC:112,132,154,174`) | ✅ | 4: `PC:112`, `:132`, `:154`, `:174`, wszystkie `rejectValue("name", "duplicate", "already exists")`. Dla porównania: `rejectValue` ma w `src/main` 13 wywołań (4 w `PetValidator`, 6 w `PC`, 1 w `VisitController`, 2 w `OwnerController`) | `$R.rejectValue("name", "duplicate", $$$)`; `$R.rejectValue($$$)` | – |
| V5 | W `src/main` nie ma `@ControllerAdvice` ani `@ExceptionHandler` | ✅ | 0 i 0 | `@ControllerAdvice`; `@ExceptionHandler($$$)` | **realny brak**: grep `ControllerAdvice\|ExceptionHandler` w `src/main/java` zwraca 0 |
| V6 | Sprawdzenie w pamięci przy dodawaniu i przy edycji to „ta sama logika w dwóch kopiach” (D8) | 🔍 | `getPet(name, flag)` ma 2 wywołania o **różnych** kształtach: `PC:111` (`getPet(pet.getName(), true)` w koniunkcji z `pet.isNew()`) i `PC:152` (`getPet(petName, false)`, potem porównanie id w `:153`). Wzorzec kształtu z dodawania pasuje tylko do `PC:111` | `$O.getPet($N, $F)`; `if ($A && $P.isNew() && $O.getPet($N, true) != null) { $$$ }` | – |
| V7 | Ścieżki zapisu zwierzęcia: dodawanie i edycja w `PetController` (raport nie wymieniał innych) | 🔍 | wywołania zapisu w `src/main`: `saveAndFlush` 2 (`PC:126`, `PC:199`), `save` 3 (`OwnerController:84`, `OwnerController:168`, `VisitController:109`). Wszystkie przez `OwnerRepository`, czyli kaskadowo także na `pets`. Sprawdzenie duplikatu poprzedza 2 z 5. Pozostałe 3 mogą zmienić imię zwierzęcia tylko przez binding, patrz D9 | `$R.saveAndFlush($X)`; `$R.save($X)` | – |
| V8 | Imię zwierzęcia zmienia się w kodzie w jednym miejscu (`updatePetDetails`) | ✅ | `setName(...)` w `src/main`: 1 (`PC:192`). Dodanie do listy: 1 (`Owner.java:112`, `getPets().add(pet)`) | `$P.setName($X)`; `getPets().add($X)` | `$O.getPets().add($X)` dał 0, to **zły wzorzec** (wywołanie bez jawnego odbiorcy). Grep `getPets()\.add` zwraca `Owner.java:112`, a poprawiony wzorzec `getPets().add($X)` daje 1 |
| V9 | Wywołania `addPet` i `getPet` pochodzą z `PetController` i `Owner` | 🔍 | `addPet` w `src/main`: 3 (`PC:103` w GET formularza, nie zapisuje; `PC:125`; `PC:197`), w `src/test`: 12. `getPet(Integer)`: 3 zewnętrzne (`PC:86`, `PC:189`, `VisitController:70`) i 1 wewnętrzne (`Owner.java:181`, `addVisit`). `getPet(String, boolean)`: 2 (`PC:111`, `PC:152`) i delegacja `Owner.java:121`. **`getPet(String)` ma w `src/main` 0 wywołań**, używają go tylko testy (`ClinicServiceTests:181,311,312`, `OwnerControllerTests:102`, `PetClinicConcurrencyTests:51`) | `$O.addPet($P)`; `$O.getPet($N, $F)`; `$O.getPet($X)`; `getPet($$$)` w `Owner.java` | ast-grep nie rozróżnia przeciążeń po typie. Rozdział na `Integer` i `String` zrobiłem po argumentach (`petId`, `id` lub literał) i potwierdziłem grepem `getPet("\|getPet(name` |
| V10 | `PetController` wczytuje ownera dwa razy w jednym żądaniu edycji | ✅ | `findById` w `PC`: 2 (`PC:69`, `PC:83`). W całym `src/main`: 5 (dodatkowo `OwnerController:67`, `:181`, `VisitController:66`) | `$R.findById($X)` | – |
| V11 | Kontroler nie ma transakcji | ✅ | `@Transactional` w `src/main`: tylko `VetRepository.java:44`, `:54` (`readOnly = true`). W `owner/` 0 | `@Transactional`; `@Transactional($$$)` | wersja bez argumentów dała 0, to **realny brak**: grep `@Transactional` zwraca tylko 2 linie z `VetRepository` (znalezione przez wariant z argumentami) |
| V12 | Nic nie przycina imion: jedyne `strip()` w `src/main` jest w `OwnerController:103`, nie ma `StringTrimmerEditor` | ✅ | `strip()`: 1 (`OwnerController:103`). `trim()` w `src/main`: 0. `new StringTrimmerEditor(...)` w `src`: 0 | `$X.strip()`; `$X.trim()`; `new StringTrimmerEditor($$$)` | **realny brak** dla obu. Grep `\.trim()\|StringTrimmerEditor` w `src` zwraca tylko `I18nPropertiesSyncTest.java:56` (test, czyta pliki properties) |
| V13 | `equalsIgnoreCase` jest użyte w regule w jednym miejscu | ✅ | 1 w `src/main`: `Owner.java:150` | `$A.equalsIgnoreCase($B)` | – |
| V14 | Binder `pet` ustawia `PetValidator` i blokuje `id`, `*.id` | ✅ | `setValidator`: 1 (`PC:96`). `setDisallowedFields("id", "*.id")`: 4 (`PC:91`, `PC:97`, `OwnerController:61`, `VisitController:53`). Repo-map mówiło o „3 kontrolerach”, a to 3 kontrolery i 4 bindery (`PC` ma osobne dla `owner` i `pet`) | `$B.setValidator($V)`; `$B.setDisallowedFields($$$)` | – |
| V15 | Limit imienia 30 jest tylko w `PetValidator`, a `NamedEntity.name` nie ma `@Size` | ✅ | `MAX_NAME_LENGTH = 30`: `PetValidator.java:36`, użyte w `:46`. `NamedEntity.java`: `@Column` (`:33`), `@NotBlank` (`:34`), `@Size` 0 | reguła `kind: field_declaration` + `regex: MAX_NAME_LENGTH`; `@NotBlank`; `@Size($$$)` | `private static final int MAX_NAME_LENGTH = $N;` i `MAX_NAME_LENGTH = $N` dały 0, to **zły wzorzec** (pełna deklaracja pola nie parsuje się jako samodzielny fragment). Grep znajduje `PetValidator.java:36`, a reguła `kind` daje 1. `@Size` w `NamedEntity`: **realny brak**, potwierdzony grepem |
| V16 | Testy kontrolera podstawiają wymyślony wyjątek w 2 miejscach, a mock `findById` zwraca jeden obiekt `Owner` | ✅ | `willThrow(new DataIntegrityViolationException(...))`: 2 (`PetControllerTests:167`/`168`, `:258`/`259`). `given(owners.findById(...)).willReturn(...)`: 1 (`PetControllerTests:86`, w `@BeforeEach`), więc oba odczyty w `PC` dostają ten sam obiekt | `$G.willThrow(new DataIntegrityViolationException($M))`; `given($R.findById($I)).willReturn($X)` | – |
| V17 | Test repozytorium sprawdza tylko typ wyjątku | ✅ | `assertThrows(DataIntegrityViolationException.class, …)`: 1 (`ClinicServiceTests:274`, w teście z `:255`) | `assertThrows(DataIntegrityViolationException.class, $$$)` | – |
| V18 | Żaden test nie wysyła parametrów zwierząt przez formularz ownera (D9) | ✅ | wzorzec `$X.param($K, $$$)` w `OwnerControllerTests` daje 33 trafienia, a żadne nie zaczyna się od `pets` | `$X.param($K, $$$)` (filtr ręczny po kluczu) | grep `"pets\[` w `src/test`: 0, czyli **realny brak** |

### SQL (grep, trzy dialekty)

| # | Twierdzenie | Werdykt | H2 (`db/h2/`) | MySQL (`db/mysql/`) | Postgres (`db/postgres/`) |
|---|---|---|---|---|---|
| S1 | Ograniczenie unikalności imienia u ownera ma nazwę tylko w H2 i Postgresie | ✅ | `schema.sql:55` `ALTER TABLE pets ADD CONSTRAINT unique_owner_pet_name UNIQUE (owner_id, name);` | `schema.sql:47` `UNIQUE (owner_id, name)`, bez nazwy | `schema.sql:45` `CREATE UNIQUE INDEX IF NOT EXISTS unique_owner_pet_name ON pets (owner_id, LOWER(name));` |
| S2 | Typ kolumny `pets.name` | ✅ | `schema.sql:48` `VARCHAR_IGNORECASE(30)` | `schema.sql:40` `VARCHAR(30)` | `schema.sql:38` `TEXT` |
| S3 | Sposób tworzenia tabeli `pets` (istotny dla istniejących baz, D6) | ✅ | `schema.sql:5` `DROP TABLE pets IF EXISTS;` i `:46` `CREATE TABLE pets (` (zawsze od nowa) | `schema.sql:38` `CREATE TABLE IF NOT EXISTS pets (`, ograniczenie w środku (`:47`) | `schema.sql:36` `CREATE TABLE IF NOT EXISTS pets (` i osobna instrukcja indeksu (`:45`) |
| S4 | Schemat MySQL nie ustawia collation ani zestawu znaków | ✅ | – | grep `COLLATE\|CHARSET` w `schema.sql`: 0. Collation jest tylko w `user.sql:3-5`, którego nic nie uruchamia | – |
| S5 | Dane startowe: `INSERT` do `pets` bez listy kolumn w H2 i MySQL, z listą w Postgresie | ✅ | 13 wierszy, `data.sql:36` `INSERT INTO pets VALUES (default, 'Leo', …)` | 13 wierszy, `data.sql:36` `INSERT IGNORE INTO pets VALUES (1, 'Leo', …)` | 13 wierszy, `data.sql:36` `INSERT INTO pets (name, birth_date, type_id, owner_id) SELECT … WHERE NOT EXISTS …` |
| S6 | Dane startowe nie mają kolizji imion u jednego ownera, także bez względu na wielkość liter | ✅ | pary (`owner_id`, `lower(name)`), `uniq -d`: 0. „Lucky” u ownerów 7 i 10 | 0 | 0 |
| S7 | `sql.init.mode=always` i brak narzędzia migracji | ✅ | – (H2 w pamięci) | `application-mysql.properties:7` | `application-postgres.properties:7`. Flyway i Liquibase w `pom.xml` i `build.gradle`: 0 (grep) |

### Co weryfikacja zmieniła w raporcie

- **D8 doprecyzowane (V6, V3):** bloki `catch` są kopiami, ale sprawdzenia w pamięci nie są. To dwa różne warianty reguły.
- **Nowy dług D9 (V7, V18):** 3 z 5 zapisów przez `OwnerRepository` w `src/main` nie mają przed sobą sprawdzenia duplikatu, a ich bindery nie blokują pól zwierząt. Sama możliwość zmiany imienia tą drogą to [I] (pytanie 5 w „Open Questions”).
- **Nowy fakt (V9):** `Owner.getPet(String)` nie ma wywołań w kodzie produkcyjnym, istnieje dla testów.
- **Korekta mapy (V14):** binder `setDisallowedFields("id", "*.id")` jest w 3 kontrolerach, ale w 4 miejscach.
- **Żadne twierdzenie nie zostało obalone.** Trzy zera z ast-grep okazały się złymi wzorcami (V1, V8, V15). Grep znalazł wystąpienia, a poprawione wzorce dały ten sam wynik co grep.
