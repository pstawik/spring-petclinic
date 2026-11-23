# Reguła unikalności imienia zwierzęcia jako metoda agregatu `Owner` — plan implementacji

## Overview

Przenosimy regułę „imię zwierzęcia jest unikalne u ownera” z `PetController` do jednej metody zapytania na agregacie `Owner` (pozycja **#1** rankingu z `research.md`: C3 + C4). Wiernie odwzorowujemy dzisiejszą semantykę (pierwsze trafienie, dwie semantyki niezapisanych zwierząt) — plan jest czystym refaktorem bez zmiany zachowania. Przełączenie predykatu na „wszystkie trafienia” (domknięcie C4) zmienia obserwowalne zachowanie, więc zgodnie z twardą regułą idzie jako **osobna zmiana** po tym planie (szkic w sekcji „Kolejna zmiana”).

Ścieżki Java względem `src/main/java/org/springframework/samples/petclinic/` (`PC` = `owner/PetController.java`, `O` = `owner/Owner.java`), testy względem `src/test/java/org/springframework/samples/petclinic/`.

## Current State Analysis

- **Dwa warianty sprawdzenia w kontrolerze** [E, research W5]:
  - dodawanie: `StringUtils.hasText(name) && pet.isNew() && owner.getPet(name, true) != null` (`PC:111`),
  - edycja: `Pet existingPet = owner.getPet(petName, false); existingPet != null && !Objects.equals(existingPet.getId(), pet.getId())` (`PC:151-155`).
- **Oba opierają się na „pierwszym trafieniu”** `Owner.getPet(String, boolean)` (`O:147-157`): pętla w kolejności listy, `return pet` przy pierwszym dopasowaniu `equalsIgnoreCase`; `ignoreNew=true` pomija niezapisane zwierzęta [E, W10].
- **Dwie semantyki niezapisanych zwierząt:** dodawanie je pomija (`true`), edycja je liczy (`false`), a ponieważ niezapisane ma `id == null`, przy edycji zawsze daje `duplicate`. Osiągalne tylko spreparowanym `pets[n]` (auto-grow kolekcji w binderze `owner`, `PC:89-92`, research W17) [I].
- **Kruchość edycji (C4):** przy jednej instancji `Owner` (OSIV albo mock) binding zmienia imię edytowanego zwierzęcia na liście ownera, więc pierwszym trafieniem może być ono samo (to samo id) i błąd się nie pojawia [I]. W produkcji (`open-in-view=false`, `application.properties:11`) `findOwner` (`PC:69`) i `findPet` (`PC:83-86`) zwracają osobne kopie, więc lista ownera ma imiona z bazy [E].
- **Testy:** `PetControllerTests` używa jednej instancji `Owner` dla każdego `findById` (`:86`), zwierzęta dodane w kolejności `petty` (id 1), `doggy` (id 2) (`:80-85`); `processUpdateFormWithDuplicateName` (`:218`) przechodzi tylko dzięki tej kolejności [E, W14]. `OwnerTests` ma 2 testy `addPet`, nic o `getPet(String, boolean)`.
- **Wzorzec agregatu:** brak warstwy serwisów jest świadomy (`83ff9a5`, `c953442`), a przejścia stanu idą do agregatu (`4725753`, `Owner.addVisit`). Predykat po id ma precedens w `Owner.addPet` (`O:108`) [E, W6].
- Build: `./mvnw -B verify` uruchamia spring-javaformat (validate) i checkstyle (`pom.xml:206-226`).

## Desired End State

- `Owner` ma jedną publiczną metodę zapytania `hasOtherPetNamed(String name, Integer excludedPetId, boolean includeUnsaved)`, która odpowiada, czy imię jest zajęte przez **inne** zwierzę, z semantyką pierwszego trafienia identyczną z dzisiejszym kontrolerem.
- `PetController` nie zawiera logiki reguły: oba handlery wywołują tę metodę i mapują `true` na `rejectValue("name", "duplicate", "already exists")`. Import `java.util.Objects` znika z `PC`.
- Kontrakt HTTP (kody błędów, widoki, statusy) bez zmian; `getPet(String)` i `getPet(String, boolean)` zostają w publicznym API `Owner`.
- Weryfikacja: `./mvnw -B verify` zielone; testy z osobnymi instancjami `Owner` (produkcyjny wariant) zielone przed i po każdej fazie.

### Key Discoveries:

- Równoważność dla faz 2–4: dodawanie `getPet(name, true) != null` ⇔ `hasOtherPetNamed(name, null, false)` (zapisane zwierzę ma id ≠ `null`); edycja ⇔ `hasOtherPetNamed(name, pet.getId(), true)` (`PC:111`, `PC:151-155`, `O:147-157`).
- Precedens predykatu po id: `Objects.equals(existingPet.getId(), pet.getId())` w `O:108`.
- Testy kontraktu HTTP sprawdzają `attributeHasFieldErrorCode("pet","name","duplicate")` (`PetControllerTests:124`, `:218`) — przetrwają przepięcie bez zmian.
- `Objects` w `PC` jest używane tylko w `:153` — po fazie 3 import jest nieużywany.

## What We're NOT Doing

- **#2 (C1)** — rozpoznanie naruszenia po nazwie ograniczenia i nazwane ograniczenie w MySQL: zmienia obserwowalne zachowanie (500 → błąd formularza na MySQL) i zależy od U1/U-OLD. Osobna zmiana.
- **#3 (C5)** — allow-lista pól w binderach (`OwnerController`, `VisitController`, `PC:89-92`): zmienia zachowanie dla spreparowanych żądań, pilność zależy od U-D9. Osobna zmiana.
- **C8** — usuwanie `Owner.getPet(String)` i `getPet(String, boolean)`: zostają w publicznym API (testy używają `getPet(String)` w 5 miejscach).
- **C2, C6, C7** — relacja równoważności imion, limit 30 znaków, narzędzie migracji: poza zakresem (research „Rozważone i odrzucone”).
- **„Wszystkie trafienia” (domknięcie C4)** — zmienia obserwowalne zachowanie (edycja na własne imię przy danych już naruszających regułę daje `duplicate`), więc to osobna zmiana po tym planie; szkic w sekcji „Kolejna zmiana”.
- Ujednolicanie semantyki niezapisanych zwierząt między dodawaniem a edycją — zachowujemy obie przez parametr `includeUnsaved`.
- Warstwa serwisów, `@Transactional`, zapytanie `exists` w `OwnerRepository`, zmiany `open-in-view`, `schema.sql`, `messages*`, szablonów.
- Test `@SpringBootTest` z `open-in-view=true`: na H2 ścieżka P2 i tak zwraca `duplicate` (nazwane ograniczenie), więc nie odróżnia starej i nowej semantyki; rozróżnia ją test MockMvc z jedną instancją `Owner` (kolejna zmiana).

## Implementation Approach

Branch by Abstraction na agregacie: guard → nowa metoda obok starej (nieużywana) → przepięcie jednego wywołania na raz. Żadna faza nie zmienia zachowania; każda jest osobnym commitem odwracalnym niezależnie. Zmiana semantyki na „wszystkie trafienia” to osobna zmiana. Bez nowych warstw — zgodnie z decyzją nośną „agregat `Owner` + repozytorium” (`83ff9a5`, `c953442`, `4725753`).

## Critical Implementation Details

**Przypięty dług (faza 2):** test jednostkowy „pierwsze trafienie to wykluczone id, dalej inne zwierzę o tym imieniu → `false`” celowo przypina dzisiejszą zależność od kolejności. Zostaje w kodzie do czasu kolejnej zmiany („wszystkie trafienia”), która odwróci to oczekiwanie.

---

## Faza 1: Testy charakteryzujące

### Overview

Przypinamy dzisiejsze zachowanie reguły na poziomie agregatu i kontrolera, w tym wariant produkcyjny (osobne kopie `Owner`), zanim ruszymy strukturę.

### Changes Required:

#### 1. Semantyka `getPet(String, boolean)`

**File**: `src/test/java/org/springframework/samples/petclinic/owner/OwnerTests.java`

**Intent**: Pinujemy semantykę metody, na której dziś opiera się reguła, żeby każda kolejna faza mogła się do niej odnieść.

**Contract**: Nowe testy jednostkowe (bez Springa): dopasowanie bez względu na wielkość liter (`"LEO"` znajduje `"Leo"`); `ignoreNew=true` pomija niezapisane zwierzę o pasującym imieniu, `ignoreNew=false` je zwraca; przy dwóch wpisach równych bez względu na wielkość liter (`"Leo"` id 1, `"leo"` id 2) zwracane jest pierwsze w kolejności listy; zwierzę z imieniem `null` jest pomijane; brak dopasowania → `null`.

#### 2. Wariant produkcyjny fixture kontrolera

**File**: `src/test/java/org/springframework/samples/petclinic/owner/PetControllerTests.java`

**Intent**: Odwzorowujemy produkcję z `open-in-view=false`, w której `findOwner` i `findPet` dostają osobne kopie `Owner`, i pinujemy kontrakt HTTP reguły w obu kolejnościach zwierząt.

**Contract**: Nowa klasa `@Nested`, w której `findById(TEST_OWNER_ID)` zwraca przy **każdym** wywołaniu świeżą instancję `Owner` z **nowymi** obiektami `Pet` o tych samych id i imionach (`willAnswer` + fabryka np. `freshOwner(order)`; współdzielone obiekty `Pet` sprawiłyby, że binding w `findPet` zmienia imię także na liście ownera z `findOwner`, czyli wariant jednej instancji), sparametryzowana kolejnością dodania (`petty, doggy` oraz `doggy, petty`). Przypadki: dodanie `"petty"` i `"PETTY"` → kod `duplicate`, widok formularza; edycja zwierzęcia `TEST_PET_ID + 1` na `"petty"` → `duplicate`; edycja `TEST_PET_ID` na `"petty"` i `"PETTY"` → redirect. Istniejące testy z jedną instancją pozostają bez zmian. Stub w klasie zagnieżdżonej nadpisuje stub z zewnętrznego `@BeforeEach`.

### Success Criteria:

#### Automated Verification:

- Nowe testy w `OwnerTests` i `PetControllerTests` przechodzą na obecnym kodzie: `./mvnw -B test -Dtest=OwnerTests,PetControllerTests`
- Formatowanie zgodne: `./mvnw spring-javaformat:apply` nie zmienia plików po zapisaniu testów
- Pełny build zielony: `./mvnw -B verify`
- `git diff --stat` pokazuje zmiany wyłącznie w `src/test`

**Implementation Note**: Faza nie ma kroków manualnych. Po zielonym buildzie przejdź do fazy 2.

---

## Faza 2: Nowa metoda `Owner.hasOtherPetNamed` (pierwsze trafienie, nieużywana)

### Overview

Dodajemy addytywnie metodę zapytania z semantyką identyczną z dzisiejszymi dwoma wariantami w kontrolerze. Nikt jej jeszcze nie wywołuje.

### Changes Required:

#### 1. Metoda zapytania na agregacie

**File**: `src/main/java/org/springframework/samples/petclinic/owner/Owner.java`

**Intent**: Jedno miejsce odpowiadające na pytanie „czy to imię zajmuje inne zwierzę tego ownera”, w kształcie, który da się podstawić za oba warianty z `PC` bez zmiany zachowania.

**Contract**: Sygnatura, od której zależą fazy 3–5:

```java
/**
 * Whether another pet of this owner already uses the given name (case-insensitive).
 * @param name the candidate name
 * @param excludedPetId id of the pet being edited, or null when adding
 * @param includeUnsaved whether pets that are not saved yet take part in the check
 */
public boolean hasOtherPetNamed(String name, Integer excludedPetId, boolean includeUnsaved)
```

Semantyka w tej fazie: znajdź **pierwsze** zwierzę na liście (kolejność `getPets()`) z imieniem różnym od `null`, równym `name` przez `equalsIgnoreCase` i spełniającym `includeUnsaved || !isNew()`; wynik `true` wtedy i tylko wtedy, gdy takie istnieje i `!Objects.equals(jegoId, excludedPetId)`. `name == null` → `false`. Istniejące metody `getPet(...)` bez zmian.

#### 2. Testy jednostkowe nowej metody

**File**: `src/test/java/org/springframework/samples/petclinic/owner/OwnerTests.java`

**Intent**: Dowodzimy równoważności z oboma dzisiejszymi wariantami na tych samych przypadkach co w fazie 1.

**Contract**: Przypadki: wariant dodawania (`excludedPetId = null`, `includeUnsaved = false`) — dopasowanie bez względu na wielkość liter → `true`, pasujące tylko niezapisane → `false`, brak → `false`; wariant edycji (`excludedPetId = id`, `includeUnsaved = true`) — to samo zwierzę → `false`, inne zwierzę → `true`, pasujące niezapisane (`id == null`) → `true`; **pinowany przypadek pierwszego trafienia**: pierwsze trafienie to wykluczone id, dalej inne zwierzę o tym imieniu → `false` (oczekiwanie zmieni kolejna zmiana).

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe nowej metody przechodzą: `./mvnw -B test -Dtest=OwnerTests`
- Pełny build zielony (w tym testy charakteryzujące z fazy 1): `./mvnw -B verify`
- `PetController.java` bez zmian w tej fazie: `git diff --quiet -- src/main/java/org/springframework/samples/petclinic/owner/PetController.java`

**Implementation Note**: Faza nie ma kroków manualnych. Po zielonym buildzie przejdź do fazy 3.

---

## Faza 3: Przepięcie edycji (`PC:151-155`)

### Overview

Handler edycji przestaje sam implementować regułę i pyta agregat.

### Changes Required:

#### 1. Handler `processUpdateForm`

**File**: `src/main/java/org/springframework/samples/petclinic/owner/PetController.java`

**Intent**: Zastępujemy blok `getPet(petName, false)` + `Objects.equals(...)` jednym wywołaniem metody agregatu, zachowując warunek `StringUtils.hasText(petName)` i wywołanie `rejectValue("name", "duplicate", "already exists")`.

**Contract**: Warunek błędu: `StringUtils.hasText(petName) && owner.hasOtherPetNamed(petName, pet.getId(), true)`. Import `java.util.Objects` usunięty (jedyne użycie było w `:153`). Blok `try/catch` i `updatePetDetails` bez zmian.

### Success Criteria:

#### Automated Verification:

- Testy kontrolera (stare i charakteryzujące) przechodzą: `./mvnw -B test -Dtest=PetControllerTests`
- Pełny build zielony, checkstyle bez nieużywanego importu: `./mvnw -B verify`
- W `PetController.java` brak wywołań `getPet($N, false)` i `Objects.equals`: `grep -c "getPet(petName, false)\|Objects" src/main/java/org/springframework/samples/petclinic/owner/PetController.java` zwraca `0`

#### Manual Verification:

- W uruchomionej aplikacji (`./mvnw spring-boot:run`, H2) edycja zwierzęcia na imię innego zwierzęcia tego ownera (także inną wielkością liter) pokazuje błąd przy polu imienia, a edycja na własne imię zapisuje się i wraca do strony ownera

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie testu manualnego przed fazą 4.

---

## Faza 4: Przepięcie dodawania (`PC:111`)

### Overview

Handler dodawania pyta ten sam agregat; reguła ma już jedno źródło.

### Changes Required:

#### 1. Handler `processCreationForm`

**File**: `src/main/java/org/springframework/samples/petclinic/owner/PetController.java`

**Intent**: Zastępujemy `owner.getPet(pet.getName(), true) != null` wywołaniem metody agregatu, zachowując warunki `StringUtils.hasText(...)` i `pet.isNew()`.

**Contract**: Warunek błędu: `StringUtils.hasText(pet.getName()) && pet.isNew() && owner.hasOtherPetNamed(pet.getName(), pet.getId(), false)` (dla nowego zwierzęcia `pet.getId()` to `null`). Blok `try/catch` bez zmian.

### Success Criteria:

#### Automated Verification:

- Testy kontrolera przechodzą: `./mvnw -B test -Dtest=PetControllerTests`
- Pełny build zielony: `./mvnw -B verify`
- `PetController` nie wywołuje już `getPet(String, boolean)`: `grep -c "getPet(pet.getName(), true)\|getPet(petName" src/main/java/org/springframework/samples/petclinic/owner/PetController.java` zwraca `0`

#### Manual Verification:

- W uruchomionej aplikacji dodanie zwierzęcia o imieniu już używanym przez tego ownera (także inną wielkością liter) pokazuje błąd przy polu imienia, a unikalne imię zapisuje się z komunikatem „New Pet has been Added”

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na potwierdzenie testu manualnego. To ostatnia faza planu.

---

## Kolejna zmiana: „wszystkie trafienia” (poza tym planem)

Wydzielona po plan-review (F1), bo zmienia obserwowalne zachowanie. Otworzyć osobno przez `/10x-new` po zakończeniu tego planu. Szkic zakresu:

- **Różnica zachowania:** przy `open-in-view=false` dotyczy tylko list ownera, które **już** zawierają dwa imiona równe bez względu na wielkość liter (MySQL z collation rozróżniającym wielkość liter, bazy sprzed `e0db9b1` — U-VAR, U-OLD) albo spreparowanych `pets[n]`. Edycja zwierzęcia na jego własne imię zgłosi wtedy `duplicate`, choć dziś przechodzi. Dodawanie bez różnic.
- **Guard przed zmianą:** test MockMvc z jedną instancją `Owner`, kolejność `doggy` (id 2), `petty` (id 1), edycja `TEST_PET_ID + 1` na `"petty"` → oczekiwane `duplicate`. Przed zmianą predykatu jest czerwony (redirect).
- **Zmiana:** `hasOtherPetNamed` zwraca `true`, gdy **którekolwiek** pasujące zwierzę (z `includeUnsaved || !isNew()`) ma id różne od `excludedPetId`; `getPet(String, boolean)` bez zmian.
- **Aktualizacja testu:** przypięty przypadek z fazy 2 zmienia oczekiwanie z `false` na `true`.

---

## Testing Strategy

### Unit Tests:

- `OwnerTests`: semantyka `getPet(String, boolean)` (faza 1), równoważność `hasOtherPetNamed` z oboma wariantami (faza 2).
- Przypadki brzegowe: wielkość liter, imię `null` na liście, niezapisane zwierzę (`id == null`) w obu semantykach, dwa wpisy równe bez względu na wielkość liter.

### Integration Tests:

- `PetControllerTests` (MockMvc): istniejący kontrakt HTTP z jedną instancją `Owner`; nowy wariant ze świeżą instancją `Owner` na każde `findById` w obu kolejnościach (produkcja z `open-in-view=false`).
- Istniejące `ClinicServiceTests`, `PetClinicIntegrationTests`, `PetClinicConcurrencyTests` w `./mvnw -B verify` jako siatka regresji.

### Manual Testing Steps:

1. `./mvnw spring-boot:run`, otwórz ownera z co najmniej dwoma zwierzętami (np. Jean Coleman: Samantha, Max).
2. Dodaj zwierzę o imieniu `max` → błąd przy polu imienia.
3. Edytuj Max na `Samantha` → błąd; edytuj Max na `MAX` → zapis i powrót do strony ownera.

## Performance Considerations

Brak zmian: predykat przechodzi po liście zwierząt jednego ownera wczytanej już `EAGER` (`O:67`), tak jak dziś.

## Migration Notes

Nie dotyczy — bez zmian schematu i danych.

## References

- Research (ranking i weryfikacja ast-grep): `context/changes/refactor-opportunities/research.md` (§C3, §C4, #1, W5, W6, W10, W14, W17)
- Raport źródłowy: `context/changes/pet-duplicate-name-analysis/research.md` (D7, D8, V3, V6, V16)
- Wzorzec predykatu po id: `src/main/java/org/springframework/samples/petclinic/owner/Owner.java:108`
- Precedens metody na agregacie: `Owner.addVisit` (`O:176-186`, commit `4725753`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Testy charakteryzujące

#### Automated

- [ ] 1.1 Nowe testy w `OwnerTests` i `PetControllerTests` przechodzą na obecnym kodzie: `./mvnw -B test -Dtest=OwnerTests,PetControllerTests`
- [ ] 1.2 Formatowanie zgodne: `./mvnw spring-javaformat:apply` nie zmienia plików po zapisaniu testów
- [ ] 1.3 Pełny build zielony: `./mvnw -B verify`
- [ ] 1.4 `git diff --stat` pokazuje zmiany wyłącznie w `src/test`

### Phase 2: Nowa metoda `Owner.hasOtherPetNamed` (pierwsze trafienie, nieużywana)

#### Automated

- [ ] 2.1 Testy jednostkowe nowej metody przechodzą: `./mvnw -B test -Dtest=OwnerTests`
- [ ] 2.2 Pełny build zielony (w tym testy charakteryzujące z fazy 1): `./mvnw -B verify`
- [ ] 2.3 `PetController.java` bez zmian w tej fazie: `git diff --quiet -- src/main/java/org/springframework/samples/petclinic/owner/PetController.java`

### Phase 3: Przepięcie edycji (`PC:151-155`)

#### Automated

- [ ] 3.1 Testy kontrolera (stare i charakteryzujące) przechodzą: `./mvnw -B test -Dtest=PetControllerTests`
- [ ] 3.2 Pełny build zielony, checkstyle bez nieużywanego importu: `./mvnw -B verify`
- [ ] 3.3 W `PetController.java` brak wywołań `getPet($N, false)` i `Objects.equals`: `grep -c "getPet(petName, false)\|Objects" src/main/java/org/springframework/samples/petclinic/owner/PetController.java` zwraca `0`

#### Manual

- [ ] 3.4 W uruchomionej aplikacji (`./mvnw spring-boot:run`, H2) edycja zwierzęcia na imię innego zwierzęcia tego ownera (także inną wielkością liter) pokazuje błąd przy polu imienia, a edycja na własne imię zapisuje się i wraca do strony ownera

### Phase 4: Przepięcie dodawania (`PC:111`)

#### Automated

- [ ] 4.1 Testy kontrolera przechodzą: `./mvnw -B test -Dtest=PetControllerTests`
- [ ] 4.2 Pełny build zielony: `./mvnw -B verify`
- [ ] 4.3 `PetController` nie wywołuje już `getPet(String, boolean)`: `grep -c "getPet(pet.getName(), true)\|getPet(petName" src/main/java/org/springframework/samples/petclinic/owner/PetController.java` zwraca `0`

#### Manual

- [ ] 4.4 W uruchomionej aplikacji dodanie zwierzęcia o imieniu już używanym przez tego ownera (także inną wielkością liter) pokazuje błąd przy polu imienia, a unikalne imię zapisuje się z komunikatem „New Pet has been Added”
