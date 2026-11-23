---
title: Agregat-strażnik niezmiennika — termin wizyty tylko na przyszły dzień
created: 2026-11-23
type: refactor-plan
---

# Agregat-strażnik niezmiennika: termin wizyty tylko na przyszły dzień

To plan refaktoru, nie implementacja. Kod produkcyjny nie był zmieniany. Dwie hipotezy sprawdziłem tymczasowym testem integracyjnym (`@SpringBootTest`, prawdziwe H2, przebieg 2026-11-23), który potem usunąłem; jego wyniki oznaczam **[E-probe]**. Pozostałe oznaczenia: **[E]** zweryfikowane w kodzie lub gicie, **[I]** wniosek.

Ścieżki Java są względem `src/main/java/org/springframework/samples/petclinic/`. Terminy z `context/domain/glossary.md`: **Termin** (rezerwacja), **Wizyta** (zdarzenie kliniczne), **Pacjent** (`Pet`), **Klient** (`Owner`).

## Krok 0 — Kontekst

- **Dokumenty wymagań:** brak PRD i `tech-stack.md` (`context/foundation/` zawiera tylko `README.md`). Źródłem reguł biznesowych jest wywiad `context/domain/00-expert-interview.md` i destylacja `context/domain/01-domain-distillation.md`. Nie ma formalnych success criteria. Oś „rdzeniowości” opiera się na „Trzech kluczowych procesach” z wywiadu (`00-expert-interview.md:37-46`).
- **Stack:** Spring Boot 4.1, Java 17, Spring Data JPA, Thymeleaf, H2/MySQL/Postgres (`AGENTS.md:3`). Runner testów: JUnit 5 przez `./mvnw test` (`AGENTS.md:17`, `:33-35`).
- **Warstwy, w których żyje logika:**
  - UI: szablony Thymeleaf i atrybuty HTML,
  - kontrolery MVC: walidacja ręczna, `BindingResult`,
  - encje: Bean Validation i metody agregatu `Owner`,
  - persystencja: `schema.sql`.

  Warstwy serwisów nie ma i jest to świadoma decyzja (`83ff9a5` „Modularize and migrate to aggregate-oriented domain”, 2016, zob. `context/changes/refactor-opportunities/plan.md`). Korzeniem agregatu dla Pacjentów i ich wizyt jest `Owner` (`owner/Owner.java:176-186`).

## Krok 1 — Niezmienniki biznesowe

| ID | Niezmiennik | Źródło w dokumencie | Gdzie w kodzie |
|---|---|---|---|
| INV-01 | **Termin wizyty rezerwuje się na dzień w przyszłości** | Termin to rezerwacja w kalendarzu (`00-expert-interview.md:56`); kalendarz to proces Core (`:39-40`) | `owner/VisitController.java:100-101`, `:84-85`; `owner/Visit.java:50-51`; `templates/fragments/inputField.html:14`; `messages.properties:9` |
| INV-02 | Termin/wizyta należy do Pacjenta tego Klienta, w którego kontekście powstaje | Historia należy do pacjenta (`:25`) | `owner/VisitController.java:70-74`; `owner/Owner.java:176-186` |
| INV-03 | Opis wizyty jest wymagany i ma ≤ 255 znaków | Dokumentacja wizyty musi być zapisana (`:42-43`) | `owner/Visit.java:43-45`; `db/h2/schema.sql:62` |
| INV-04 | Data urodzenia Pacjenta nie leży w przyszłości | — (tylko kod) | `owner/PetController.java:115-118` i `:158-161` (dwie kopie) |
| INV-05 | Pacjent ma gatunek ze słownika | Gatunek to dana słownikowa (`:57`) | `owner/PetValidator.java:51-52` (tylko dla nowego); `owner/PetTypeFormatter.java:52-59`; `db/h2/schema.sql:50`, `:54` |
| INV-06 | Imię Pacjenta jest unikalne u Klienta | **Domena temu przeczy** (`:87`, `:89`) | `db/h2/schema.sql:55`; `owner/PetController.java:111-113`, `:151-155` |
| INV-07 | Termin może się nie odbyć i nie zaśmieca historii choroby | `:56` | brak (DR-02 w destylacji) |
| INV-08 | Zmarły Pacjent nie pojawia się przy umawianiu | `:91` | brak |

## Krok 2 — Klasyfikacja i wybór #1

| ID | (a) Rdzeniowość | (b) Rozsmarowanie | (c) Egzekwowanie |
|---|---|---|---|
| INV-01 | **Core**: kalendarz = przychód (`:39-40`) | **5 miejsc w 4 warstwach**: UI (`inputField.html:14`), kontroler (`VisitController.java:84-85`, `:100-101`), encja (`Visit.java:50-51`), komunikaty (`messages.properties:9`). W agregacie i w bazie: nic | **Naruszalny**: dwa potwierdzone obejścia [E-probe], patrz Krok 3 |
| INV-02 | Core | 2 miejsca (kontroler, agregat) | Egzekwowany: `Assert` w `Owner.addVisit` (`Owner.java:183`) |
| INV-03 | Core (dokumentacja) | 2 (encja, schemat) | Egzekwowany na formularzu wizyty (`@Valid`, `VisitController.java:98`); obejście przez edycję Klienta [I, ten sam mechanizm co INV-01 B2] |
| INV-04 | Supporting | 2 kopie w kontrolerze | Egzekwowany w formularzu Pacjenta, poza agregatem |
| INV-05 | Supporting | 3 warstwy | Egzekwowany (FK `NOT NULL`) |
| INV-06 | Supporting; **domena przeczy** | 3 warstwy | Egzekwowany — ale to reguła do usunięcia, nie do strzeżenia (destylacja DR-01, Q-01) |
| INV-07, INV-08 | Core / Supporting | 0 | Nieobecne. To nowa funkcja, a nie refaktor |

**Wybór #1: INV-01 — Termin wizyty rezerwuje się na dzień w przyszłości.**

- **Najbardziej rdzeniowy z istniejących:** dotyczy kalendarza, który wywiad wymienia jako pierwszy proces dający wartość (`:39-40`).
- **Najsłabiej egzekwowany:** reguła żyje w pięciu miejscach, ale nie w agregacie ani w bazie. Kod obchodzi ją na dwa sposoby, oba potwierdzone na prawdziwym H2.
- **Domena się z nim zgadza:** dla Terminu (rezerwacji) wywiad tę regułę potwierdza. Spór z domeną (destylacja I7, DR-02) dotyczy tego, że ten sam byt `Visit` służy też za Wizytę kliniczną. Ten plan strzeże reguły Terminu i **nie** rozstrzyga rozdziału Termin/Wizyta (Q-03 w destylacji). Projekt jest pomyślany tak, by rozdział był później prosty.
- **Dlaczego nie INV-06**, mimo #1 w rankingu destylacji: tamten ranking mierzył wartość × ryzyko szkody. INV-06 to reguła, której domena nie chce. Agregat-strażnik by ją utrwalił, a to ten sam błąd, który destylacja wytknęła planowi `refactor-opportunities` (O-01).

## Krok 3 — Diagnoza INV-01

### Gdzie dziś żyje reguła

| # | Warstwa | Miejsce | Co robi |
|---|---|---|---|
| L1 | UI | `templates/fragments/inputField.html:14` — `th:min="${minVisitDate}"` | Przeglądarka nie pozwala **wybrać** daty ≤ dziś. Tylko podpowiedź UX; spreparowane żądanie lub wyczyszczone pole ją omija |
| L2 | Kontroler | `owner/VisitController.java:83-86` — `minVisitDate()` = `LocalDate.now().plusDays(1)` | Dostarcza L1 wartość „jutro”. Fragment `inputField` jest wspólny, więc `th:min` trafia do każdego pola daty, ale wartość jest tylko w modelu `VisitController` [E] |
| L3 | Encja | `owner/Visit.java:50-51` — konstruktor ustawia `date = now() + 1` | Domyślna wartość, nie reguła. Publiczne `setDate` (`:58-60`) pozwala ustawić cokolwiek |
| L4 | Kontroler | `owner/VisitController.java:100-101` — `if (visit.getDate() != null && !visit.getDate().isAfter(LocalDate.now()))` → `rejectValue("date", "typeMismatch.visitDate")` | **Jedyny serwerowy strażnik**, tylko na ścieżce `POST …/visits/new` |
| L5 | Komunikaty | `messages.properties:9` (+ tłumaczenia dodane w `753d35c`) | Tekst „Visit date must be in the future” |
| — | Agregat | `owner/Owner.java:176-186` `addVisit`, `owner/Pet.java:81-83` `addVisit` | Sprawdzają tylko `null` i przynależność Pacjenta (INV-02). **Daty nie sprawdzają** |
| — | Baza | `db/h2/schema.sql:58-63` — `visit_date DATE` bez `NOT NULL` i `CHECK` | Nic |

Regułę wprowadził `753d35c` („Validate future visit dates”, 2026-06-01): 12 plików, w tym `inputField.html` i `VisitControllerTests` (+15) [E].

### Gdzie egzekucja zawodzi

- **B1. Błąd „połknięty” przy pustej dacie [E-probe].** Warunek L4 zaczyna się od `visit.getDate() != null &&`, a `Visit.date` nie ma `@NotNull` (`Visit.java:39-41`). Pusty `date` w formularzu wiąże się jako `null`, sprawdzenie jest pomijane i zapis przechodzi. Przebieg: `POST /owners/6/pets/7/visits/new` z `date=""`, `description=probe-empty-date` → w bazie powstała wizyta `id=5`, `date=null`. Pole w szablonie nie ma `required` (`inputField.html:14`), więc to osiągalne ze zwykłego UI, nie tylko spreparowanym żądaniem [E].
- **B2. Ścieżka obchodząca strażnika [E-probe].** `POST /owners/{id}/edit` wiąże `Owner` z polami Pacjentów i ich wizyt, bo binder blokuje tylko `id` i `*.id` (`OwnerController.java:59-62`), a `Owner` jest ładowany z wizytami (`Owner.java:67`, `Pet.java:56`, `FetchType.EAGER`). Przebieg: `pets[0].visits[0].date=2000-01-01` → wizyta `id=2` Pacjenta `8` zmieniła datę z `2013-01-02` na `2000-01-01`, a opis na `probe-owner-edit` (zapis przez `OwnerController.java:168`). Ta ścieżka nie przechodzi przez L4. Destylacja i research `pet-duplicate-name-analysis` (D9) opisywały ten mechanizm dla imion; tu jest potwierdzony dla dat wizyt.
- **B3. Stan agregatu zmieniany przed sprawdzeniem reguły.** `loadPetWithVisit` dodaje nową `Visit` do Pacjenta (`VisitController.java:78-79`), zanim binder i L4 ją sprawdzą. Przy błędzie nic się nie zapisuje, bo `save` jest tylko w `:109`. Agregat jest jednak przez chwilę w stanie nielegalnym, a o tym, czy trafi do bazy, decyduje wyłącznie kolejność instrukcji w kontrolerze [E].
- **B4. Klient jako jedyny strażnik:** dla ścieżki głównej nie — L4 działa na serwerze. Dla B1 jedynym ograniczeniem jest `th:min` w przeglądarce, a ono pustego pola nie blokuje [E].
- **B5. Czas rozproszony:** `LocalDate.now()` jest wołane trzy razy niezależnie (`Visit.java:51`, `VisitController.java:85`, `:100`). Reguły nie da się przetestować bez zależności od zegara systemowego [E].

## Krok 4 — Projekt agregatu-strażnika

### Decyzja o korzeniu

Korzeniem zostaje **`Owner`** (Klient), bo:

- jest jedynym agregatem z repozytorium dla Pacjentów i wizyt (`OwnerRepository`, brak `PetRepository`),
- jest zgodny z decyzją `83ff9a5` i z precedensem przejść stanu w agregacie (`Owner.addVisit`).

Destylacja (BC-03) wskazuje, że historia powinna należeć do Pacjenta. Przeniesienie korzenia na Pacjenta to osobna decyzja (Q-04 w destylacji). Projekt to ułatwia, bo reguła ląduje w jednej metodzie, którą da się przenieść.

### Metody domenowe i błędy

```java
// owner/Owner.java — JEDYNE miejsce egzekwowania INV-01 (i INV-02)
public Visit bookVisit(Integer petId, LocalDate date, String description, LocalDate today) {
    // preconditions: fail-fast, nic nie zmienia stanu, dopóki wszystkie nie przejdą
    Pet pet = getPet(petId);
    if (pet == null)                     throw new PetNotFoundForOwnerException(getId(), petId);   // INV-02
    if (date == null)                    throw new VisitDateRequiredException();                    // INV-01 (faza zmiany B)
    if (!date.isAfter(today))            throw new VisitDateNotInFutureException(date, today);      // INV-01
    Visit visit = Visit.booked(date, description);  // package-private fabryka
    pet.addVisit(visit);                             // stan zmieniany dopiero po wszystkich sprawdzeniach
    return visit;
}

// owner/Visit.java
static Visit booked(LocalDate date, String description) { ... }   // tylko z Owner.bookVisit
protected Visit() { }                                              // dla JPA
// brak publicznych setDate/setDescription (zmiana C) — binder nie ma czego ustawić

// owner/VisitBookingException.java (nowe) — nazwane błędy domenowe
public abstract sealed class VisitBookingException extends RuntimeException
    permits VisitDateNotInFutureException, VisitDateRequiredException, PetNotFoundForOwnerException {
    public abstract String field();        // "date" / "petId" — do mapowania na formularz
    public abstract String errorCode();    // "typeMismatch.visitDate" — istniejący klucz komunikatu
}
```

- **INV-03** (opis) zostaje w Bean Validation na formularzu (`VisitForm`, niżej). Agregat może go dodatkowo sprawdzać, ale to nie jest cel tego planu.
- `today` jest parametrem, a nie `LocalDate.now()` w środku. Zamyka to B5: testy jednostkowe agregatu nie zależą od zegara, a kontroler podaje `LocalDate.now()` w jednym miejscu.
- `Owner.addVisit(Integer, Visit)` (`Owner.java:176-186`) jest wołane w testach (`ClinicServiceTests.java:229`). Zostaje, ale deleguje do tych samych sprawdzeń albo jest oznaczone `@Deprecated` — decyzja na etapie `/10x-plan`.

### Repozytorium i transakcja

- Bez zmian w `OwnerRepository`: agregat ładuje `findById` (`OwnerRepository.java:60`), a zapisuje `save(owner)`.
- **Atomowość:** INV-01 jest lokalny dla jednego Terminu i nie zależy od innych wierszy, więc nie wymaga blokady ani transakcji obejmującej odczyt. Zapis Terminu to jedno `save(owner)` z kaskadą (`Owner.java:67`, `CascadeType.ALL`), wykonywane w transakcji metody repozytorium Spring Data [I]. Nie dodajemy warstwy serwisów ani `@Transactional` w kontrolerze.
- **Pas bezpieczeństwa w bazie (opcjonalnie, osobna zmiana):** `visit_date NOT NULL` we wszystkich trzech `schema.sql`. Warunku „w przyszłości” nie da się wyrazić `CHECK`-iem, bo zależy od dnia zapisu, a historyczne wizyty mają daty z przeszłości (`db/h2/data.sql:50-53`).

### Cienki kontroler

```java
// owner/VisitForm.java (nowe) — obiekt wejścia formularza, nie encja
record VisitForm(@DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date,
                 @NotBlank @Size(max = 255) String description) { }

// owner/VisitController.java
@PostMapping("/owners/{ownerId}/pets/{petId}/visits/new")
String processNewVisitForm(@PathVariable int ownerId, @PathVariable int petId,
                           @Valid @ModelAttribute("visit") VisitForm form, BindingResult result, ...) {
    Owner owner = owners.findById(ownerId).orElseThrow(...);          // parse / load
    if (result.hasErrors()) return VIEW;                               // błędy wejścia (opis)
    try {
        owner.bookVisit(petId, form.date(), form.description(), LocalDate.now());  // reguła
    } catch (VisitBookingException e) {
        result.rejectValue(e.field(), e.errorCode());                  // mapowanie błędu domenowego
        return VIEW;                                                   // nic nie zapisano
    }
    owners.save(owner);
    redirectAttributes.addFlashAttribute("message", "Your visit has been booked");
    return "redirect:/owners/{ownerId}";
}
```

- `loadPetWithVisit` nie tworzy już `Visit` ani nie dodaje jej do Pacjenta (zamyka B3). Ładuje tylko `owner` i `pet` do widoku, a jako `visit` wystawia pusty `VisitForm` z domyślną datą „jutro”.
- `minVisitDate` (L2) i `th:min` (L1) **zostają** jako podpowiedź UX. Egzekucja jest na serwerze, w agregacie.
- `PetNotFoundForOwnerException` na ścieżce GET dalej kończy się dzisiejszym `IllegalArgumentException` (`VisitController.java:71-74`). Kontrakt dla nieistniejącego Pacjenta się nie zmienia.

## Krok 5 — Before/after, fazy, testy

### Before / after

| # | Before | After |
|---|---|---|
| L1 | `th:min` w przeglądarce (`inputField.html:14`) | Bez zmian — tylko podpowiedź UX |
| L2 | `minVisitDate()` (`VisitController.java:83-86`) | Bez zmian; zasila L1 i domyślną datę `VisitForm` |
| L3 | Konstruktor „jutro” + publiczne settery (`Visit.java:50-60`) | Fabryka `Visit.booked(...)` widoczna w pakiecie, konstruktor `protected` dla JPA. Settery usunięte (zmiana C) |
| L4 | `if (date != null && !date.isAfter(now))` w kontrolerze (`VisitController.java:100-101`) | Usunięte. Kontroler mapuje `VisitBookingException` na `rejectValue` z tym samym kodem `typeMismatch.visitDate` |
| L5 | Klucz `typeMismatch.visitDate` (`messages.properties:9`) | Bez zmian — kod błędu jest kontraktem z testami i tłumaczeniami |
| Agregat | `Owner.addVisit` sprawdza tylko `null` i Pacjenta (`Owner.java:176-186`) | `Owner.bookVisit` sprawdza INV-02 i INV-01 przed zmianą stanu |
| B1 | Pusta data zapisuje się jako `null` | Zmiana B: `VisitDateRequiredException` → błąd formularza |
| B2 | Edycja Klienta przestawia daty wizyt | Zmiana C: bez setterów binder nie ma czego ustawić |
| B3 | `Visit` dodana do Pacjenta przed sprawdzeniem | Dodawana dopiero w `bookVisit`, po sprawdzeniach |

### Plan faz

Każda faza to osobny commit, który da się odwrócić niezależnie. Zmiana A to czysty refaktor bez zmiany zachowania. Zmiany B i C zmieniają obserwowalne zachowanie, więc są **osobnymi zmianami** po A (zgodnie z zasadą z `CLAUDE.md` lekcji M4L4).

**Zmiana A — refaktor (zachowanie bez zmian)**

| Faza | Co | Test-first? | Odwrót |
|---|---|---|---|
| A1 | Testy charakteryzujące: przypinają dzisiejsze zachowanie L4 oraz **B1 i B2 jako przypięty dług** (testy z adnotacją, że zmiana B/C je odwróci) | **Tak** (to same testy) | Usunięcie testów |
| A2 | `VisitBookingException` + `Owner.bookVisit` + `Visit.booked`, nieużywane przez kontroler. W A `date == null` **jest akceptowane** (przypięty dług B1), żeby przepięcie w A3 nie zmieniło zachowania | **Tak**: testy jednostkowe `OwnerTests` (red → green) | Usunięcie nowych typów i metody |
| A3 | `VisitController.processNewVisitForm` przez `VisitForm` → `owner.bookVisit`; `loadPetWithVisit` bez tworzenia `Visit` (B3) | Nie — chronią je testy z A1 i istniejące `VisitControllerTests` | Revert commita, A2 zostaje nieużywane |
| A4 | Usunięcie martwego kodu L4; `Owner.addVisit` deleguje do `bookVisit` albo zostaje `@Deprecated` | Nie | Revert commita |

**Zmiana B — data Terminu wymagana (zmienia zachowanie: zamyka B1)**
- B1: odwrócenie przypiętego testu B1 (red), potem precondition `date == null → VisitDateRequiredException` (green). **Test-first.** Komunikat: istniejący `typeMismatch.visitDate` albo nowy klucz w 11 plikach `messages*` (`I18nPropertiesSyncTest`, `AGENTS.md:9`) — decyzja na etapie `/10x-plan`.

**Zmiana C — strażnik nie do obejścia (zmienia zachowanie spreparowanych żądań: zamyka B2)**
- C1: odwrócenie przypiętego testu B2 (red), potem usunięcie publicznych `Visit.setDate`/`setDescription` (green). **Test-first.** Dziś wołają je tylko testy (`OwnerControllerTests.java:101`, `ClinicServiceTests.java:227`) [E], więc te fixture'y przechodzą na `Visit.booked`/`bookVisit`. JPA używa dostępu do pól, bo adnotacje są na polach (`Visit.java:39-45`), więc usunięcie setterów nie psuje mapowania [I].
- Pokrewna, szersza zmiana (allow-lista pól bindera, C5 z `refactor-opportunities`) zamknęłaby też INV-03 i INV-06 na tej samej ścieżce. Pozostaje osobna.

### Przypadki testowe niezmiennika

**Jednostkowe — `Owner.bookVisit` (`OwnerTests`, bez Springa, stały `today = 2026-11-23`):**

| # | Wejście | Oczekiwane | Rodzaj |
|---|---|---|---|
| T1 | `date = today + 1` | Termin dodany do Pacjenta, zwrócona `Visit` z tą datą | legalne |
| T2 | `date = today + 365` | dodany | legalne |
| T3 | `date = today` | `VisitDateNotInFutureException`; liczba wizyt Pacjenta bez zmian | nielegalne (granica) |
| T4 | `date = today − 1` | `VisitDateNotInFutureException`; stan bez zmian | nielegalne |
| T5 | `petId` spoza Klienta | `PetNotFoundForOwnerException`; stan bez zmian | nielegalne (INV-02) |
| T6 | `petId = null` | `PetNotFoundForOwnerException` (dziś `Assert` → `IllegalArgumentException`) | nielegalne |
| T7 | `date = null` | **A:** dodany (przypięty dług B1). **B:** `VisitDateRequiredException` | przypięte → odwracane w B |
| T8 | Dwa udane `bookVisit` dla jednego Pacjenta | Obie wizyty, kolejność wg daty (`Pet.java:58`) | legalne |

**Kontroler — `VisitControllerTests` (MockMvc):**

| # | Żądanie | Oczekiwane |
|---|---|---|
| C-T1 | `date = jutro`, opis | redirect `/owners/{id}`, `save` wywołane (istnieje: `:76-84`) |
| C-T2 | `date = dziś` | widok formularza, kod `typeMismatch.visitDate` na `date`, `save` **niewywołane** (istnieje: `:97-106`, dopisać `verify(never())`) |
| C-T3 | `date = ""` | **A:** redirect (przypięty dług). **B:** błąd na `date` |
| C-T4 | opis 256 znaków | błąd na `description` (istnieje: `:110-118`) |

**Integracyjny — `@SpringBootTest` na H2 (wzór: tymczasowy test z tej analizy):**

| # | Żądanie | Oczekiwane |
|---|---|---|
| I-T1 | `POST /owners/6/edit` z `pets[0].visits[0].date=2000-01-01` | **A:** data wizyty zmieniona (przypięty dług B2). **C:** data bez zmian |
| I-T2 | `POST /owners/6/pets/7/visits/new` z `date=""` | **A:** wizyta z `date=null` w bazie. **B:** brak nowej wizyty |

### Nowe nazwy load-bearing

Projekt nie prowadzi rejestru kontraktów: wyszukiwanie `load-bearing` / `contract registry` w `context/` nic nie zwraca. Nazwy, które po zmianie staną się kontraktem:

| Nazwa | Rodzaj | Kto od niej zależy |
|---|---|---|
| `Owner.bookVisit(Integer, LocalDate, String, LocalDate)` | metoda agregatu | kontroler, testy, przyszłe przeniesienie korzenia na Pacjenta |
| `VisitBookingException` + `VisitDateNotInFutureException`, `VisitDateRequiredException`, `PetNotFoundForOwnerException` | błędy domenowe | mapowanie w kontrolerze |
| `Visit.booked(LocalDate, String)` | fabryka (pakietowa) | `Owner`, fixture'y testów |
| `VisitForm` | obiekt wejścia | szablon `createOrUpdateVisitForm.html` (`th:object="${visit}"`) |
| `typeMismatch.visitDate` | klucz komunikatu (istniejący) | 11 plików `messages*`, `VisitControllerTests.java:104` |

**Nazewnictwo a słownik:** słownik nazywa ten byt Terminem i każe nie mówić `Visit` na rezerwację. Plan zostaje przy `Visit`, bo zmiana nazwy to decyzja Q-05, a rozdział Terminu i Wizyty to decyzja Q-03 (obie w destylacji). Nowa metoda nazywa się `bookVisit` („zarezerwuj”), co odpowiada semantyce Terminu i dzisiejszemu komunikatowi „Your visit has been booked” (`VisitController.java:110`). Gdy zapadnie Q-03, `bookVisit` przechodzi do bytu `Appointment` bez zmiany reguły.

## Otwarte pytania

| ID | Pytanie | Kto |
|---|---|---|
| P-01 | Zmiana B: nowy klucz komunikatu „data wymagana” czy istniejący `typeMismatch.visitDate`? | Tech lead |
| P-02 | `Owner.addVisit`: usunąć, delegować czy `@Deprecated`? | Tech lead |
| P-03 | Czy rozdział Termin/Wizyta (Q-03 w destylacji) ma wyprzedzić zmianę C? Jeśli tak, setterów nie usuwamy z `Visit`, tylko przenosimy regułę na `Appointment` | Menadżer przychodni + tech lead |

## Konfrontacja z M4L3/M4L4

Źródła: `context/changes/pet-duplicate-name-analysis/research.md` (M4L3, dalej **R3**) i `context/changes/refactor-opportunities/research.md` (M4L4, dalej **R4**). Wybór #1 (INV-01) się nie zmienia. Niewiadomą U-D9 (R4:248) rozstrzygnąłem drugim tymczasowym testem `@SpringBootTest` na H2 (2026-11-23, plik usunięty): **[E-probe-2]**.

**Wynik [E-probe-2]** — `POST /owners/6/edit` z danymi Klienta i jednym polem `pets[0].name` (Pacjent `8` „Max”; drugi Pacjent to `7` „Samantha”):

| Wartość `pets[0].name` | Odpowiedź | Stan w bazie |
|---|---|---|
| `Max` (bez zmiany) | 200 | bez zmian |
| 31 × `x` | **500** | bez zmian: `PetValidator` (limit 30, `PetValidator.java:46-47`) pominięty, zatrzymała dopiero kolumna `VARCHAR_IGNORECASE(30)` (`db/h2/schema.sql:48`) |
| `samantha` | **500** | bez zmian: zatrzymało ograniczenie `unique_owner_pet_name` (`db/h2/schema.sql:55`). `OwnerController` nie łapie `DataIntegrityViolationException` |
| `Samantha ` (spacja na końcu) | 200 | **Pacjent 8 przemianowany na `'Samantha '`**: u Klienta są teraz „Samantha” i „Samantha ” |

### 1. INV-06 („imię Pacjenta unikalne u Klienta”) na trzech osiach, w porównaniu z INV-01

| Oś | INV-06 (imię) | INV-01 (#1, data Terminu) | Kto „wygrywa” |
|---|---|---|---|
| **(a) Rdzeniowość** | Supporting: rejestr Pacjentów (SD-04 w destylacji). Do tego **domena tej reguły nie chce**: imię nie jest unikalne, ma dać ostrzeżenie (`00-expert-interview.md:87`, `:89`) | Core: kalendarz = przychód (`:39-40`); dla Terminu domena regułę potwierdza (`:56`) | INV-01 bardziej rdzeniowy |
| **(b) Rozsmarowanie** | **Większe.** Java: dwa różne warianty sprawdzenia w kontrolerze (`PetController.java:111` z `getPet(name, true)` i `:151-155` z `getPet(name, false)` + porównanie id — R3 D8, R3:169), wspólne „pierwsze trafienie” w `Owner.getPet(String, boolean)` (`Owner.java:147-157`), dwa identyczne bloki `catch` (`PetController.java:128-134`, `:170-176`, ast-grep W1/W2 w R4:336-337) i rozpoznanie po napisie `contains("unique_owner_pet_name")` (`PetController.java:202-205`, R3 D1). SQL: 3 dialekty z **3 różnymi definicjami** — nazwane `UNIQUE` (`db/h2/schema.sql:55`), **nienazwane** `UNIQUE (owner_id, name)` (`db/mysql/schema.sql:47`), indeks z `LOWER(name)` (`db/postgres/schema.sql:45`). W sumie **4 różne relacje „to samo imię”** (R3 §1.5, R3:140-150) | 5 miejsc w 4 warstwach, ale **jedna** semantyka (`isAfter(now)`) i jedno serwerowe sprawdzenie (`VisitController.java:100-101`) | INV-06 bardziej rozsmarowany |
| **(c) Egzekwowanie** | **Silniejsze, ale niespójne.** Dwie linie obrony: w pamięci i w bazie. Na ścieżce D9 ograniczenie w bazie **trzyma** — kolizja nie trafia do bazy, choć kończy się 500 zamiast błędem formularza [E-probe-2]. Słabości: MySQL bez nazwy ograniczenia → najpewniej 500 także na zwykłej ścieżce (R3:44, :104, [I, U1]); stare bazy MySQL mogą nie mieć ograniczenia (R3 D6, R3:167, [I]); równoważność imion różni się między warstwami, więc „Samantha ” przechodzi jako inne imię [E-probe-2] | **Słabsze.** Brak drugiej linii obrony: ani agregat, ani baza nie znają reguły (`Owner.java:176-186`, `db/h2/schema.sql:58-63`). Oba obejścia **zapisują naruszenie po cichu**, bez błędu (B1 i B2 z Kroku 3, [E-probe]) | INV-01 słabiej egzekwowany |

**Wniosek:** INV-06 jest bardziej rozsmarowany niż #1, ale mniej rdzeniowy i lepiej pilnowany. Naruszenie zwykle zatrzymuje (choć brzydko, przez 500), a INV-01 przepuszcza je bez śladu. Do tego INV-06 to reguła, którą domena odrzuca, więc agregat-strażnik byłby tu złym narzędziem. Właściwy ruch to decyzja Q-01 (destylacja), a nie strażnik. Wybór #1 zostaje.

### 2. Czy projektowany agregat (`Owner` jako korzeń dla `Pet`) jest odporny na ścieżkę D9?

**Nie sam z siebie.** Odporność daje dopiero zmiana C, i tylko dla tego, co obejmuje.

- **Mechanizm D9** (R3 D9, R3:170; R4 C5, R4:179-197): binder `Owner` blokuje tylko `id` i `*.id` (`OwnerController.java:59-62`; to samo `VisitController.java:51-54` i binder `owner` w `PetController.java:89-92`). Spring wiąże więc zagnieżdżone ścieżki `pets[n].…` przez **publiczne settery** encji wewnątrz agregatu: `Pet.setName` (dziedziczony z `model/NamedEntity.java:41-43`), `Visit.setDate` (`Visit.java:58-60`). Potem `save(owner)` (`OwnerController.java:168`) zapisuje całość kaskadą (`Owner.java:67`). **Żadna metoda agregatu nie leży na tej ścieżce**, więc każda reguła umieszczona w `Owner` jest pomijana. [E-probe] potwierdza to dla dat wizyt, [E-probe-2] dla imion. U-D9 z R4 jest rozstrzygnięte: binding działa.
- **Dla INV-01 w tym planie:** zmiana A (`Owner.bookVisit`) **nie** zamyka D9. Zamyka je dopiero zmiana C, bo bez publicznych `Visit.setDate`/`setDescription` binder nie ma czego ustawić. Bez zmiany C agregat byłby „jedynym miejscem egzekwowania” tylko na papierze. To trzeba wyraźnie zapisać w `/10x-plan`.
- **Dla INV-06, gdyby trafił do agregatu** (np. plan `refactor-opportunities`, metoda `Owner.hasOtherPetNamed`): przeniesienie sprawdzenia do `Owner` **nie zamyka** D9. Ścieżka edycji Klienta nadal ustawia `pets[n].name` przez `NamedEntity.setName` z pominięciem tej metody, a jedynym strażnikiem zostaje ograniczenie w bazie. Na H2 daje ono 500, a przy wariantach równoważności (spacja) nie zadziała wcale [E-probe-2]. Odpowiednik zmiany C jest tu droższy: `setName` jest wspólny dla `Pet`, `PetType` i `Specialty` (`NamedEntity`), a `PetController` wiąże `@Valid Pet` bezpośrednio (`PetController.java:108`, `:145`), więc potrzebny byłby `PetForm` i metoda `Owner.renamePet(...)`.
- **Dwie drogi do odporności** (do decyzji w `/10x-plan`):
  1. **Brak publicznych mutatorów osiągalnych z bindera** dla danych pilnowanych przez agregat: obiekty formularza (`VisitForm`, ewentualnie `PetForm`) plus metody agregatu. Strażnik działa wtedy niezależnie od konfiguracji kontrolerów.
  2. **Allow-lista pól w binderach** (R4 #3, C5, koszt S, R4:296-310): zamyka D9 dla wszystkich reguł naraz (INV-01, INV-03, INV-06, limit imienia), ale zależy od dyscypliny w każdym kontrolerze. W `PetController` trzeba objąć także binder `owner` (R4 W17, R4:352).

  Plan proponuje 1. dla INV-01 (zmiana C). Droga 2 jest tańszym uzupełnieniem dla pozostałych reguł, które przecinają tę samą ścieżkę.
- **Wniosek uboczny dla R4:** pozycja #3 (C5) ma teraz pilność rozstrzygniętą, a nie [U]. Spreparowane żądanie zmienia imię Pacjenta z pominięciem `PetValidator` i sprawdzenia duplikatu, a kolizja kończy się 500 [E-probe-2]. Nie zmieniam R4. Zapisuję to tutaj jako wejście do następnego `/10x-plan`.

### 3. Czy normalizacja imion (akcenty, spacje) to decyzja biznesowa?

**Częściowo.** R4 zatrzymał się na tym samym pytaniu (C2: „właściwa naprawa wymaga decyzji produktowej o relacji równoważności imion”, R4:42, :122, :316; macierz U-VAR, R4:246). Wywiad odpowiada na część:

- **Rozstrzygnięte przez domenę:**
  - **Wyszukiwanie** ignoruje wielkość liter i znaki diakrytyczne („zoe” znajduje „Zoë” i „Zoe”, `00-expert-interview.md:88`).
  - Podobne imię u Klienta daje **ostrzeżenie, nie blokadę** (`:89`).
  - Na listach imię pokazuje się tak, jak je zapisano („Zoë – kot…”, `:90`).

  Normalizacja służy więc porównaniom (szukanie, ostrzeżenie), a nie zmianie zapisanej wartości ani regule blokującej.
- **Decyzja biznesowa, której wywiad nie domyka:** co dokładnie jest „podobnym imieniem” przy ostrzeżeniu. Wywiad podaje przykład literówki „Zoi” (`:70`), która nie jest ani różnicą wielkości liter, ani diakrytyku.
- **Decyzja techniczna, nie biznesowa:** spacje na początku i końcu. Nikt w domenie nie rozróżnia „Samantha” i „Samantha ”, a dziś różne warstwy traktują je różnie i system zapisuje obie wersje [E-probe-2]; R3 §1.5 przewidywał to jako [I/U]. To higiena wejścia (np. przycinanie na granicy formularza), więc należy do tech leada, a nie do eksperta.
- **Zależność:** jeśli Q-01 (destylacja) zachowa regułę **blokującą**, relacja równoważności staje się warunkiem poprawności danych, a zmiana jej na istniejącej bazie jest migracją (R4 C7, U-OLD). Jeśli zostanie tylko ostrzeżenie, ta sama decyzja kosztuje mało, bo dotyczy tylko porównania w zapytaniu.

| ID | Pytanie | Kto zna odpowiedź |
|---|---|---|
| N-01 | Które imiona recepcja uznaje za „podobne” przy ostrzeżeniu „Ten klient ma już pacjenta…”: tylko różnicę wielkości liter i diakrytyków („Zoe”/„Zoë”), czy też literówki („Zoi”) i zdrobnienia? | Menadżer przychodni / kierownik recepcji |
| N-02 | Czy imię zapisujemy dokładnie tak, jak podał je Klient (z diakrytykami), i normalizujemy tylko przy porównaniu? Wywiad (`:90`) to sugeruje, ale tego nie przesądza | Menadżer przychodni |
| N-03 | Czy przycinamy spacje na początku i końcu wszystkich pól tekstowych przy wejściu (dziś tylko wyszukiwanie nazwiska, `OwnerController.java:103`) i jak czyścimy istniejące wiersze z końcową spacją? | Tech lead |
| N-04 | Czy kolejność decyzji to Q-01 (blokada czy ostrzeżenie), a dopiero potem N-01? Bez Q-01 nie wiadomo, czy równoważność to warunek poprawności danych, czy tylko jakość wyszukiwania | Maintainer repo / product owner |
