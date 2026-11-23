---
title: Anti-Corruption Layer — kontrakt błędów silnika bazy danych
created: 2026-11-23
type: refactor-plan
---

# Anti-Corruption Layer: kontrakt błędów silnika bazy danych

To plan refaktoru, nie implementacja. Kod produkcyjny nie był zmieniany. Oznaczenia:
- **[E]** — zweryfikowane w repo,
- **[E-doc]** — z oficjalnej dokumentacji biblioteki (URL w tekście),
- **[I]** — wniosek,
- **[U]** — niewiadoma.

Ścieżki Java są względem `src/main/java/org/springframework/samples/petclinic/`, w skrócie `PC` = `owner/PetController.java`. Odwołania **R3** i **R4** prowadzą do `context/changes/pet-duplicate-name-analysis/research.md` i `context/changes/refactor-opportunities/research.md`. Terminy pochodzą z `context/domain/glossary.md`.

## Krok 0 — Kontekst

- **Dokumenty bazowe:** brak PRD i `tech-stack.md`. W `README.md` są dwie deklaracje o wymienialności:
  - `README.md:68`: „A similar setup is provided for MySQL and PostgreSQL … whenever the database type changes, the app needs to run with a different profile: `spring.profiles.active=mysql` … or `spring.profiles.active=postgres`”. **Silnik bazy ma być wymienialny samym profilem.**
  - `README.md:158`: „If you are interested in using a different technology stack to implement the Pet Clinic, please join the community there” (forki). **Stos technologiczny (JPA, Thymeleaf) wymienialny nie jest.** Jego wymiana to osobny projekt.
- **Stack:** Spring Boot 4.1, Java 17 (`AGENTS.md:3`), Hibernate ORM 7.4.1, sterowniki H2 2.4.240, MySQL Connector/J 9.7.0, PostgreSQL. Obrazy baz: `mysql:9.7`, `postgres:18.4` (`docker-compose.yml:3`, `:15`).
- **Zależności zewnętrzne (manifest `pom.xml`):** `spring-boot-starter-data-jpa` (`:52`), `-cache` (`:48`), `-thymeleaf` (`:56`), `-validation` (`:60`), `-webmvc` (`:64`), `cache-api` (`:69`), `jakarta.xml.bind-api` (`:73`), `h2` (`:78`), `caffeine` (`:83`), `mysql-connector-j` (`:88`), `postgresql` (`:93`).
- **Warstwy:**
  - UI: Thymeleaf `templates/`,
  - kontrolery MVC,
  - encje-agregat `Owner`,
  - repozytoria Spring Data,
  - DDL w trzech dialektach `db/{h2,mysql,postgres}/schema.sql`.

  Warstwy serwisów brak, i to świadomie (`83ff9a5`).

## Krok 1 — Przeciekające zależności

| ID | Zależność | Gdzie przecieka (wszystkie miejsca, które ją „znają”) | Granica, którą łamie |
|---|---|---|---|
| **LK-1** | **Kontrakt błędów silnika bazy** (format komunikatu sterownika i nazwy ograniczeń) przez `org.springframework.dao.DataIntegrityViolationException` | Java produkcyjna: `PC:23` (import), `PC:128` i `PC:170` (`catch`), `PC:202-205` (`message.toLowerCase().contains("unique_owner_pet_name")`). DDL: `db/h2/schema.sql:55` (nazwane), `db/postgres/schema.sql:45` (nazwany indeks z `LOWER`), `db/mysql/schema.sql:47` (**nienazwane**). Testy: `PetControllerTests.java:35`, `:168`, `:259` (wymyślony komunikat `"Duplicate key: unique_owner_pet_name"`), `service/ClinicServiceTests.java:22`, `:274` | **Kontroler webowy zna tekst komunikatu sterownika bazy i nazwę obiektu DDL.** Decyzja o odpowiedzi HTTP zależy od napisu, który każdy silnik formatuje inaczej |
| LK-2 | JPA (`jakarta.persistence`) w modelu i graf encji w UI | 9 plików encji: `model/BaseEntity.java`, `model/NamedEntity.java`, `model/Person.java`, `owner/Owner.java`, `owner/Pet.java`, `owner/PetType.java`, `owner/Visit.java`, `vet/Specialty.java`, `vet/Vet.java`. UI chodzi po grafie encji: `templates/owners/ownerDetails.html:48` (`owner.pets`), `:67` (`pet.visits`), `templates/vets/vetList.html:20-21` (`vet.specialties`, `vet.nrOfSpecialties`). Działa tylko dzięki `FetchType.EAGER` (`owner/Owner.java:67`, `owner/Pet.java:56`, `vet/Vet.java:47`) przy `spring.jpa.open-in-view=false` (`application.properties:11`) | Encja persystencji = model widoku |
| LK-3 | JAXB/Jackson: kontrakt wire = encja JPA | `vet/Vet.java:33`, `:59` (`@XmlElement`), `vet/Vets.java:21-22`, `:30`, `:35` (`@XmlRootElement`, opakowanie „so it is simpler for JSon/Object mapping”, `vet/VetController.java:74-75`), `vet/VetController.java:73-78` (`@ResponseBody Vets` z encjami). Test kontraktu: `vet/VetControllerTests.java:108` (`$.vetList[0].id`) | Odpowiedź `GET /vets` to zserializowana encja JPA (`id`, `specialties`, getter `nrOfSpecialties`) |
| LK-4 | Paginacja Spring Data (`org.springframework.data.domain`) | `owner/OwnerController.java`, `owner/OwnerRepository.java`, `vet/VetController.java`, `vet/VetRepository.java` | `Page`/`Pageable` w kontrolerach; do szablonów trafiają już liczby i listy |
| LK-5 | Cache (`@Cacheable`, JCache) | `vet/VetRepository.java:18`, `:45`, `:55`; `system/CacheConfiguration.java:19-24`, `:37` | Polityka cache na interfejsie repozytorium |
| LK-6 | Bean Validation (`jakarta.validation`) | 7 plików: encje (`model/NamedEntity.java`, `model/Person.java`, `owner/Owner.java`, `owner/Visit.java`) i kontrolery (`OwnerController`, `PetController`, `VisitController`) | Świadome sprzężenie: limity `@Size` mają odpowiadać kolumnom (`AGENTS.md:31`) |
| — (nie przeciek) | Hierarchia wyjątków Spring DAO (`org.springframework.dao.DataAccessException`) w sygnaturach repozytorium | `vet/VetRepository.java:19` (import), `:46` i `:56` (`throws DataAccessException` przy obu `findAll`), `:52` (Javadoc `@throws`). Poza tym plikiem `DataAccessException` nie występuje nigdzie w `src/` [E, grep]. Pochodzi z `83ff9a5` (2016) i `8ad9c05` (2021, paginacja) [E, `git log -S`] | Granicy nie łamie: zob. „VetRepository a LK-1” niżej |

**VetRepository a LK-1 (korekta K-1 po przeglądzie):** `VetRepository` **nie jest częścią LK-1**, tylko innym, nieszkodliwym przypadkiem.

- **Typ jest neutralny wobec silnika.** `DataAccessException` to korzeń przenośnej hierarchii wyjątków Springa. Jej celem jest właśnie ukrycie wyjątków sterownika (`SQLException`, kody i komunikaty producenta), więc jest to warstwa antykorupcyjna dostarczana przez sam framework.
- **Deklaracja nie niesie wiedzy.** `DataAccessException` jest wyjątkiem niekontrolowanym, więc `throws` w sygnaturze to wyłącznie dokumentacja. Nikt go nie łapie ani nie rozpoznaje: poza `VetRepository` grep nie znajduje go w `src/` [E].
- **LK-1 wygląda inaczej.** Kontroler łapie `DataIntegrityViolationException` i **czyta tekst komunikatu sterownika**, żeby wybrać odpowiedź HTTP (`PC:202-205`). Przeciekiem jest wiedza o formacie komunikatu i nazwie obiektu DDL, a nie sam import pakietu `org.springframework.dao`. Dlatego nowy adapter (`JpaOwnerStore`) też będzie importował `org.springframework.dao`, i to jest poprawne.
- **Wniosek:** `VetRepository` zostaje bez zmian. Pakiet `org.springframework.dao` nie nadaje się na znacznik przecieku. Kryterium w Kroku 6 opiera się na wzorcu zawężonym do LK-1, a dla wzorca szerokiego wymienia `VetRepository` jako jawny wyjątek.

## Krok 2 — Klasyfikacja i wybór #1

| ID | (a) Warstwy / pliki | (b) Ryzyko i koszt wymiany dziś | (c) Deklaracja wymienialności | Ocena |
|---|---|---|---|---|
| **LK-1** | 3 warstwy (web, DDL, testy): 1 plik produkcyjny Java, 3 DDL, 2 klasy testów | **Wymiana już jest zepsuta.** Na MySQL ograniczenie nie ma nazwy, więc napis nie pasuje i duplikat wykryty przez bazę kończy się 500 (R3:44, :104; potwierdzone dokumentacją w Kroku 5). Zmiana nazwy ograniczenia w DDL po cichu psuje rozpoznanie, a testy kontrolera tego nie zauważą, bo mają własną kopię napisu (R3 D1, R3:162) | **Tak**: `README.md:68` — inny silnik = inny profil. **Kod tego nie dotrzymuje** | **#1** |
| LK-2 | Najszersze: 9 encji + szablony + konfiguracja fetch | Bardzo wysokie | **Nie**: `README.md:158` odsyła inny stack do forków | Świadomy wybór sample'a, nie rozjazd |
| LK-3 | 2 warstwy (model, kontrakt HTTP), 3 pliki | Średnie: zmiana encji zmienia publiczny JSON | Brak | Realny przeciek, #2 |
| LK-4 | 2 warstwy, 4 pliki | Niskie | Brak | Idiomatyczne w Spring |
| LK-5 | 2 pliki | Niskie | Brak | Do odnotowania |
| LK-6 | 7 plików | Niskie | Sprzężenie deklarowane (`AGENTS.md:31`) | Celowe |

**Wybór #1: LK-1, kontrakt błędów silnika bazy w kontrolerze webowym.** Plików jest najmniej, ale przeciek przecina najgroźniejszą granicę: warstwa HTTP podejmuje decyzję na podstawie tekstu komunikatu sterownika bazy. Jako jedyny łamie też wprost deklarację z dokumentu (`README.md:68`), i to już dziś, na wspieranym profilu `mysql`. LK-2 jest szerszy, ale dokument nie obiecuje wymienialności JPA. LK-3 jest realny, ale nikt nie deklaruje stabilności tego kontraktu.

**Zastrzeżenie domenowe:** ograniczenie, którego dotyczy LK-1, pilnuje reguły „imię Pacjenta unikalne u Klienta”, a domena tę regułę odrzuca (destylacja DR-01, Q-01; `02-invariant-aggregate-refactor.md`, „Konfrontacja”). Jeśli Q-01 zniesie blokadę, znika jedyny wpis w ACL i ograniczenie w DDL, a port zostaje pusty. Dlatego plan zaczyna od faz przydatnych w obu wariantach (testy kontraktu, F1), a resztę odpala dopiero po Q-01 (zob. „Plan faz”).

## Krok 3 — Diagnoza LK-1

**Duplikacja i przecieki:**

| # | Miejsce | Co wie o zależności |
|---|---|---|
| D-1 | `PC:23` | Import typu wyjątku Spring DAO w kontrolerze webowym |
| D-2 | `PC:124-134` i `PC:167-176` | Dwa identyczne bloki `try { …saveAndFlush… } catch (DataIntegrityViolationException ex) { if (!isDuplicatePetNameViolation(ex)) throw ex; … rejectValue("name","duplicate") }` (ast-grep W1, W2, R4:336-337) |
| D-3 | `PC:202-205` | **Rozpoznanie po napisie w komunikacie**: `ex.getMessage().toLowerCase().contains("unique_owner_pet_name")`. Nie przechodzi łańcucha przyczyn i nie używa SQLState (W3, R4:338) |
| D-4 | `db/h2/schema.sql:55`, `db/postgres/schema.sql:45`, `db/mysql/schema.sql:47` | Trzy różne deklaracje: nazwane `CONSTRAINT`, nazwany `UNIQUE INDEX` z `LOWER(name)` i nienazwane `UNIQUE`. Napis z D-3 zgadza się z dwiema z trzech |
| D-5 | `PetControllerTests.java:168`, `:259` | Testy podstawiają **wymyślony** komunikat zawierający napis, więc nie sprawdzają prawdziwego kontraktu sterownika (R3:47) |
| D-6 | `ClinicServiceTests.java:274` | Sprawdza tylko typ wyjątku na H2 |
| D-7 | `owner/Owner.java:150` vs `db/h2/schema.sql:48` | Java naśladuje semantykę porównania bazy (`equalsIgnoreCase` ↔ `VARCHAR_IGNORECASE`). Ta wiedza o silniku jest rozsmarowana, ale to temat C2 (R4) i normalizacji N-01…N-03, a nie tego ACL |

**Deklaracja a kod:** `README.md:68` obiecuje, że zmiana silnika to zmiana profilu. Na profilu `mysql` ta sama operacja (duplikat wykryty przez bazę) daje błąd formularza na H2 i 500 na MySQL. Przyczyną jest D-3 + D-4 (R3:98-104). Profil nie wystarcza; trzeba by też zmienić DDL, a kod o tym nie mówi.

**Brak granicy klient/serwer:** aplikacja renderuje po stronie serwera (Thymeleaf), więc biblioteka serwerowa nie trafia do bundla klienta. Przeciek idzie z warstwy persystencji do warstwy HTTP i nie wychodzi poza serwer [E].

## Krok 4 — Projekt ACL

### Zasada

Wiedza o tym, jak silnik bazy zgłasza naruszenie ograniczenia (typ wyjątku, łańcuch przyczyn, nazwa obiektu DDL, kwalifikacja nazwą tabeli, wielkość liter), żyje w **jednym** value objekcie wewnątrz adaptera. Domena i kontrolery znają tylko błąd domenowy.

### Value object — jedyne miejsce wiedzy o kształcie zależności

```java
// owner/store/StoreConstraint.java  (adapter; package-private)
enum StoreConstraint {
    PET_NAME_PER_OWNER("unique_owner_pet_name");        // ta sama nazwa w 3 schema.sql (faza F4)

    private final String ddlName;

    /** Konwersja z typu biblioteki: łańcuch przyczyn → znane ograniczenie domenowe. */
    static Optional<StoreConstraint> of(DataIntegrityViolationException ex) {
        // 1. przejdź getCause() aż do org.hibernate.exception.ConstraintViolationException
        // 2. wymagaj getKind() == ConstraintKind.UNIQUE          (nie NOT_NULL, nie FOREIGN_KEY)
        // 3. nazwa = normalize(getConstraintName()):
        //      lowercase;                                         H2 zgłasza nazwy wielkimi literami (R3:102)
        //      obetnij kwalifikator "schemat."/"tabela."          MySQL ≥ 8.0.19 dokleja nazwę tabeli
        // 4. dopasuj do ddlName; brak dopasowania → Optional.empty()
    }

    /** Operacja domenowa: przekład na nazwany błąd domenowy. */
    DomainException toDomainError(Owner owner) {
        return switch (this) {
            case PET_NAME_PER_OWNER -> new PetNameAlreadyTakenException(owner.getId());
        };
    }
}
```

### Wąski port i adapter

```java
// owner/OwnerStore.java — PORT (domena; zero importów org.springframework.dao, org.hibernate)
public interface OwnerStore {
    /** Zapisuje agregat natychmiast (flush).
     *  @throws PetNameAlreadyTakenException gdy baza odrzuci imię Pacjenta jako zajęte */
    void store(Owner owner);
}

// owner/PetNameAlreadyTakenException.java — błąd domenowy (domena)
public final class PetNameAlreadyTakenException extends RuntimeException { ... }

// owner/store/JpaOwnerStore.java — ADAPTER (jedyny kod znający DataIntegrityViolationException)
@Component
class JpaOwnerStore implements OwnerStore {
    private final OwnerRepository owners;
    public void store(Owner owner) {
        try {
            owners.saveAndFlush(owner);
        } catch (DataIntegrityViolationException ex) {
            throw StoreConstraint.of(ex)
                .map(c -> c.toDomainError(owner))
                .orElseThrow(() -> ex);          // fail-fast: nieznane naruszenie leci dalej, nic nie jest połykane
        }
    }
}
```

- **Zakres portu jest celowo wąski:** tylko zapis, bo tylko zapis zgłasza naruszenia ograniczeń. Odczyty (`findById`, `findByLastNameStartingWith`) zostają na `OwnerRepository`. Paginacja (LK-4) to inny przeciek i nie wchodzi w ten plan.
- **Transakcja:** `saveAndFlush` wymusza wykonanie SQL wewnątrz `store`, więc wyjątek bazy powstaje w adapterze, a nie przy commicie poza nim. Dziś `PC:126` i `PC:199` też używają `saveAndFlush`, dokładnie z tego powodu [E].
- **Katalog adaptera:** `owner/store/` to nowy podpakiet. `AGENTS.md:25` opisuje konwencję „encja + repozytorium + kontroler w jednym pakiecie funkcji”. Podpakiet jest jej świadomym, małym odstępstwem i potrzebuje decyzji w `/10x-plan` (alternatywa: klasy pakietowe w `owner/` i kryterium grep po nazwach plików).

### Cienki kontroler

```java
// PC — processCreationForm / processUpdateForm (oba warianty identycznie)
try {
    owner.addPet(pet);                 // lub updatePetDetails(owner, pet)
    ownerStore.store(owner);
} catch (PetNameAlreadyTakenException e) {
    result.rejectValue("name", "duplicate", "already exists");   // ten sam kod i widok co dziś
    return VIEWS_PETS_CREATE_OR_UPDATE_FORM;
}
```

Usunięte z `PC`: import `DataIntegrityViolationException`, oba bloki `catch` w obecnej postaci i `isDuplicatePetNameViolation`.

## Krok 5 — Dowód izolacji, before/after, kontrakt biblioteki

### Co dotyka wymiana silnika lub sterownika po refaktorze

| Scenariusz | Co się zmienia | Co **nie** zmienia się |
|---|---|---|
| Nowy silnik (np. MariaDB) przez profil, zgodnie z `README.md:68` | `db/<silnik>/schema.sql` z ograniczeniem o nazwie `unique_owner_pet_name` + ewentualnie reguła normalizacji nazwy w `StoreConstraint.of` | Tabele i kolumny, `OwnerStore`, `PetNameAlreadyTakenException`, `PC`, kod błędu `duplicate`, `messages*`, szablony, testy kontrolera |
| Zmiana nazwy ograniczenia w DDL | `ddlName` w `StoreConstraint` + DDL | Wszystko poza adapterem i DDL. Test adaptera na H2 (F1) wykrywa rozjazd w CI |
| Zmiana ORM-a lub sposobu zgłaszania wyjątków (np. Hibernate → inny dostawca JPA) | `StoreConstraint.of` (rozpoznanie typu w łańcuchu przyczyn) | Port, domena, kontroler, UI |
| Gdyby Q-01 zniósł blokadę | Usunięcie `PET_NAME_PER_OWNER`, ograniczenia z 3 DDL i gałęzi `catch` w `PC` | Port może zostać na kolejne ograniczenia albo zostać usunięty; nic poza `owner/` |

### Before / after

| Miejsce | Before | After |
|---|---|---|
| `PC:23` | `import org.springframework.dao.DataIntegrityViolationException;` | Brak. `PC` importuje tylko `OwnerStore` i `PetNameAlreadyTakenException` |
| `PC:124-134` | `try { addPet; owners.saveAndFlush } catch (DIVE) { if (!napis) throw; rejectValue }` | `try { addPet; ownerStore.store } catch (PetNameAlreadyTakenException) { rejectValue }` |
| `PC:167-176` + `:199` | To samo dla edycji | To samo, przez `ownerStore.store` |
| `PC:202-205` | `message.contains("unique_owner_pet_name")` | Usunięte. Rozpoznanie robi `StoreConstraint.of` po `getKind()` i `getConstraintName()` |
| `PetControllerTests.java:35`, `:168`, `:259` | Mock `OwnerRepository` rzuca `DataIntegrityViolationException("Duplicate key: unique_owner_pet_name")` | Mock `OwnerStore` rzuca `PetNameAlreadyTakenException`. Test kontrolera nie zna bazy |
| `ClinicServiceTests.java:274` | Typ wyjątku na H2 | Zostaje (repozytorium). Nowy test adaptera pinuje przekład na prawdziwym H2 (F1) |
| UI (`createOrUpdatePetForm.html`, `messages.properties:4`) | Błąd `duplicate` → „is already in use” | Bez zmian. **UI dostaje gotowy błąd domenowy zmapowany na pole formularza**, nigdy surowy komunikat sterownika. Dziś też go nie pokazuje, ale o tym, czy pokazać błąd formularza, czy 500, decyduje napis z komunikatu |

### Kontrakt biblioteki: rozstrzygnięcie otwartych pytań

U1 (R3:303, R4:244) i U-PG (R4:245) dotyczą kontraktu sterowników. Rozstrzygam je z dokumentacji:

| Pytanie | Odpowiedź | Źródło |
|---|---|---|
| Jak nazywa się nienazwany `UNIQUE (owner_id, name)` w MySQL? | Nazwą pierwszej kolumny: „if you do not assign a name, the index is assigned the same name as the first indexed column, with an optional suffix (`_2`, `_3`, …)”. Czyli `owner_id`, **nie** `unique_owner_pet_name` | [E-doc] https://dev.mysql.com/doc/refman/8.4/en/create-table.html |
| Kod i SQLState duplikatu w MySQL; czy nazwa klucza jest kwalifikowana? | Błąd 1062 `ER_DUP_ENTRY`, SQLSTATE `23000`. Od 8.0.19: „Duplicate key error information was extended to include the table name of the key” | [E-doc] https://dev.mysql.com/doc/mysql-errors/8.4/en/server-error-reference.html, https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-19.html |
| Czy w Postgresie naruszenie `CREATE UNIQUE INDEX` zgłasza nazwę indeksu jako nazwę ograniczenia? | Tak: „indexes are treated as constraints, even if they weren't created with constraint syntax”. SQLSTATE `23505` (`unique_violation`) | [E-doc] https://www.postgresql.org/docs/current/protocol-error-fields.html, https://www.postgresql.org/docs/current/errcodes-appendix.html |
| H2 | Kod `23505` (`DUPLICATE_KEY_1`) dla naruszenia unikalnego indeksu lub klucza głównego. Nazwa ograniczenia w komunikacie jest potwierdzona logiem surefire (R3:102) | [E-doc] https://h2database.com/javadoc/org/h2/api/ErrorCode.html |
| Czy Hibernate daje rodzaj i nazwę ograniczenia bez parsowania komunikatu? | Tak: `ConstraintViolationException.getConstraintName()` („the name of the violated constraint, if known”, `@Nullable`) i `getKind()` → `ConstraintKind {CHECK, FOREIGN_KEY, NOT_NULL, OTHER, UNIQUE}`. Projekt używa Hibernate 7.4.1 | [E-doc] https://docs.hibernate.org/orm/7.0/javadocs/org/hibernate/exception/ConstraintViolationException.html |

**Wnioski i gdzie je zakodować:**

1. **U1 rozstrzygnięte co do nazwy [E-doc].** Na MySQL napis `unique_owner_pet_name` nie może się pojawić, bo klucz nazywa się `owner_id`. Dzisiejsze 500 na MySQL wynika więc z kontraktu sterownika, a nie z przypadku. Otwarte [U] zostaje tylko to, jak Hibernate 7.4 wyciąga nazwę na MySQL 9.7 (`owner_id` czy `pets.owner_id`). Normalizacja w `StoreConstraint.of` obsługuje oba warianty. Test F1 na MySQL (Testcontainers) to pinuje.
2. **Rozpoznanie po `getKind() == UNIQUE` + nazwie, nie po SQLState.** `23000` w MySQL to cała klasa naruszeń integralności, a nie tylko unikalność, więc SQLState nie odróżniłby duplikatu od innego naruszenia. Ta decyzja żyje w `StoreConstraint.of`, a nie w kontrolerze.
3. **Nazwa ograniczenia musi być jawna w każdym dialekcie.** Docelowo MySQL ma dostać `UNIQUE KEY unique_owner_pet_name (owner_id, name)`. Strona CREATE TABLE nie potwierdza, że samo `CONSTRAINT <symbol>` staje się nazwą indeksu, więc nazwę podajemy jako `index_name` [I, do potwierdzenia testem F1]. To jest zmiana zachowania (MySQL: 500 → błąd formularza) i dotyka istniejących baz (U-OLD, R4 C7). Dlatego jest osobną zmianą (F4).

## Krok 6 — Weryfikacja i plan

### Kryterium sukcesu (grep)

~~Po refaktorze `grep -rln "DataIntegrityViolationException\|unique_owner_pet_name\|org.hibernate" src/main/java` → wyłącznie `owner/store/`~~. Pierwotne kryterium było spełnialne, ale niejednoznaczne: nie mówiło, czemu pomija pakiet `org.springframework.dao`, więc szerszy grep dawał 2 pliki zamiast 1 (korekta K-1). Doprecyzowane kryteria (oba muszą przejść):

**K-LK1 (wzorzec zawężony do przecieku):**

```
grep -rlE "DataIntegrityViolationException|unique_owner_pet_name|org\.hibernate" src/main/java
→ wyłącznie pliki w src/main/java/org/springframework/samples/petclinic/owner/store/
   (dziś: owner/PetController.java)
```

**K-DAO (wzorzec szeroki, z jawnym wyjątkiem):**

```
grep -rlE "org\.springframework\.dao|org\.hibernate|unique_owner_pet_name" src/main/java
→ wyłącznie pliki w owner/store/ ORAZ vet/VetRepository.java
   (dziś: owner/PetController.java, vet/VetRepository.java)
```

`vet/VetRepository.java` to jawny wyjątek: deklaratywne `throws DataAccessException` z przenośnej hierarchii Springa, bez rozpoznawania komunikatów (zob. „VetRepository a LK-1” w Kroku 1). Jeśli w `owner/` lub `vet/` poza `owner/store/` pojawi się jakiekolwiek nowe trafienie, kryterium nie przechodzi.

Poza `src/main/java`: `unique_owner_pet_name` legalnie zostaje w `src/main/resources/db/*/schema.sql`, bo to strona DDL tego samego adaptera.

**Liczba plików, które dziś znają zależność** (format „N (raport: M)”: N to wynik grepa z 2026-11-23, M to liczba podana w pierwszej wersji raportu):

| Zakres i wzorzec | Dziś | Po refaktorze |
|---|---|---|
| `src/main/java`, K-LK1 | **1 (raport: 1)**: `owner/PetController.java` | wyłącznie `owner/store/` (2 nowe pliki: `StoreConstraint`, `JpaOwnerStore`) |
| `src/main/java`, K-DAO | **2 (raport: 1)**: `owner/PetController.java`, `vet/VetRepository.java`. Inwentarz LK-1 w Kroku 1 podawał tylko `PetController` | `owner/store/` + `vet/VetRepository.java` (jawny wyjątek) |
| `src/test/java`, K-LK1 i K-DAO | **2 (raport: 2)**: `owner/PetControllerTests.java`, `service/ClinicServiceTests.java` | `service/ClinicServiceTests.java` (bez zmian) + nowy `JpaOwnerStoreTests.java` |
| `src/main/resources/db`, napis `unique_owner_pet_name` | **2 (raport: 3)**: `h2/schema.sql`, `postgres/schema.sql`. Raport liczył też `mysql/schema.sql`, który zna ograniczenie, ale bez nazwy | 3 po F4 (zmiana B) |

**Pliki szczegółowo** (liczba trafień grepa K-DAO / K-LK1 w pliku):

| Plik | Dziś zna zależność | Po refaktorze |
|---|---|---|
| `owner/PetController.java` | tak: K-DAO 2 linie (`:23`, `:204`), K-LK1 5 linii (`:23`, `:128`, `:170`, `:202`, `:204`) | **nie** |
| `vet/VetRepository.java` | K-DAO 1 linia (`:19`); `DataAccessException` łącznie w 4 liniach (`:19`, `:46`, `:52`, `:56`). K-LK1: 0 | bez zmian (jawny wyjątek K-DAO) |
| `owner/store/StoreConstraint.java` (nowy) | — | tak (jedyne miejsce rozpoznania: `org.hibernate`, nazwa ograniczenia) |
| `owner/store/JpaOwnerStore.java` (nowy) | — | tak (`catch DataIntegrityViolationException`) |
| `owner/OwnerStore.java`, `owner/PetNameAlreadyTakenException.java` (nowe) | — | nie (domena) |
| `PetControllerTests.java` | tak (`:35`, `:168`, `:259`) | **nie** (mock `OwnerStore`) |
| `JpaOwnerStoreTests.java` (nowy, H2) | — | tak (test adaptera) |
| `ClinicServiceTests.java` | tak (`:22`, `:274`) | tak (test repozytorium, bez zmian) |
| `db/{h2,postgres}/schema.sql` | nazwa ograniczenia | bez zmian |
| `db/mysql/schema.sql` | ograniczenie bez nazwy | bez zmian w zmianie A; nazwane w F4 (zmiana B) |

### Plan faz

Zgodnie z konwencją projektu:
- najpierw testy pilnujące obecnego zachowania,
- Branch by Abstraction,
- każda faza to osobny commit odwracalny niezależnie,
- zmiana zachowania jako osobna zmiana.

Commity z `Signed-off-by` (`AGENTS.md:11`). Przed pushem musi przejść `./mvnw -B verify` (`AGENTS.md:16`).

**Zmiana A — ACL bez zmiany zachowania**

| Faza | Co | Test-first? | Zależność od Q-01 |
|---|---|---|---|
| F1 | **Testy kontraktu sterownika:** `JpaOwnerStoreTests` na H2 (CI bez Dockera) pinuje `getKind()` i `getConstraintName()` w łańcuchu przyczyn dla duplikatu imienia. To samo w `MySqlIntegrationTests` i `PostgresIntegrationTests` (pinuje dzisiejsze `owner_id` na MySQL, rozstrzyga resztę U1/U-PG) | **Tak** (to same testy) | Przydatne w obu wariantach Q-01 |
| F2 | `OwnerStore`, `PetNameAlreadyTakenException`, `JpaOwnerStore`, `StoreConstraint` obok starego kodu, **nieużywane** przez `PC` | **Tak**: testy adaptera z F1 przełączone na `store()` (red → green) | **Po Q-01** |
| F3 | Przepięcie `PC` na `OwnerStore` (najpierw dodawanie, potem edycja: dwa commity). Usunięcie `isDuplicatePetNameViolation` i importu. Testy kontrolera mockują port | Nie: chronią je istniejące `PetControllerTests` (kod `duplicate`) i `PetClinicConcurrencyTests` | Po Q-01 |

Zachowanie w zmianie A: na H2 i Postgresie bez zmian (nazwa pasuje). Na MySQL też bez zmian, bo `owner_id` nie pasuje do `ddlName`, więc adapter rzuca wyjątek dalej i nadal jest 500. Zmiana A jest czystym refaktorem także na MySQL.

**Zmiana B — dotrzymanie `README.md:68` na MySQL (zmienia zachowanie)**

| Faza | Co | Test-first? |
|---|---|---|
| F4 | `db/mysql/schema.sql:47`: nazwany klucz `unique_owner_pet_name`. Test F1 na MySQL odwraca oczekiwanie (`owner_id` → `unique_owner_pet_name`), a test kontrolera na profilu `mysql` oczekuje błędu formularza zamiast 500 | **Tak** |
| F4a | Istniejące bazy MySQL: ograniczenie siedzi w `CREATE TABLE IF NOT EXISTS`, więc stare bazy go nie dostaną (R3 D6, R4 C7). Trzeba ręcznego DDL albo narzędzia migracji | Decyzja właściciela (U-OLD) |

### Otwarte pytania

| ID | Pytanie | Kto |
|---|---|---|
| A-01 | Czy realizujemy F2–F4 przed rozstrzygnięciem Q-01 (blokada imienia czy ostrzeżenie)? Rekomendacja: tylko F1, reszta po Q-01 | Tech lead / maintainer repo |
| A-02 | Podpakiet `owner/store/` czy klasy pakietowe w `owner/` (konwencja `AGENTS.md:25`)? | Tech lead |
| A-03 | Czy są wdrożenia na MySQL z bazą sprzed `e0db9b1`, które trzeba objąć F4a? | Właściciel produktu |
| A-04 | Czy LK-3 (`GET /vets` zwraca encję JPA) jest publicznym kontraktem, którego ktoś używa? Od tego zależy, czy to kolejny kandydat na ACL | Maintainer repo |
