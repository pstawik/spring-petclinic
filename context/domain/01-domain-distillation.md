---
title: Destylacja domeny — Spring PetClinic
created: 2026-11-23
type: domain-distillation
---

# Destylacja domeny — Spring PetClinic

Mapa domeny przychodni weterynaryjnej zestawiona z tym, co faktycznie modeluje kod. Produktem jest mapa, nie kod. Pierwsze uruchomienie, więc nie ma poprzedniej wersji do porównania; identyfikatory (`UL-`, `BC-`, `SD-`, `AGG-`, `DR-`, `Q-`) są stabilne na potrzeby kolejnych przebiegów.

## Krok 0 — Kontekst projektu

**Źródła dokumentowe (przeczytane):**

| Źródło | Co zawiera | Ocena |
|---|---|---|
| `context/domain/00-expert-interview.md` | Wywiad z menadżerem przychodni: procesy, role, 5 źle nazywanych terminów, identyfikacja pacjenta | **Główne źródło wiedzy domenowej** |
| `README.md` | Uruchomienie, bazy danych, kontener | Brak treści domenowej |
| `AGENTS.md` | Zasady budowania, struktura pakietów | Tylko struktura |
| `context/changes/refactor-opportunities/plan.md` | Aktywny plan refaktoru reguły imienia (status `plan_reviewed`) | Materiał o decyzjach, nie o domenie |

**Ograniczenie:** w repo **nie ma PRD ani `tech-stack.md`** (`context/foundation/` zawiera tylko `README.md`). Nie ma więc formalnych success criteria ani non-goals. Klasyfikacja subdomen opiera się na sekcji „Trzy kluczowe procesy” z wywiadu (`00-expert-interview.md:37-46`), a nie na celach produktu zapisanych przez właściciela.

**Stack i struktura:** Spring Boot 4.1, Java 17, Spring Data JPA, Thymeleaf; H2 domyślnie, MySQL/PostgreSQL przez profile (`AGENTS.md:3`). Brak warstwy serwisów: logika biznesowa żyje w encjach (`owner/Owner.java`) i kontrolerach (`owner/PetController.java`, `owner/VisitController.java`). Persystencja: `src/main/resources/db/{h2,mysql,postgres}/schema.sql`, `ddl-auto=none`. UI: `src/main/resources/templates/`, teksty w `messages/messages*.properties`.

Ścieżki Java poniżej są względem `src/main/java/org/springframework/samples/petclinic/`.

**Zakres wyszukiwań „BRAK w kodzie”:** `grep -rniE` po `src/main/java`, `src/main/resources/templates`, `src/main/resources/db/h2` i `messages.properties`. Jedyne trafienia (`th:case`, status HTTP w `templates/error.html`) nie są pojęciami domenowymi.

## Krok 1 — Ubiquitous Language

### Pojęcia z dokumentu i ich obecność w kodzie

| ID | Pojęcie | Definicja (z wywiadu) | Źródło | W kodzie |
|---|---|---|---|---|
| UL-01 | **Pacjent** | Zwierzę, któremu prowadzimy dokumentację, także gospodarskie, egzotyczne albo stado | `00-expert-interview.md:25`, `:54` | Jako `Pet` (`owner/Pet.java:46`, tabela `pets`). Nazwa wprost odradzana w `:54` |
| UL-02 | **Opiekun / Klient** | Osoba lub firma odpowiedzialna za pacjenta: decyduje, podpisuje zgody, płaci | `:26`, `:55` | Jako `Owner extends Person` (`owner/Owner.java:50`). Jedna rola, tylko osoba fizyczna (imię i nazwisko z `model/Person.java:31-39`) |
| UL-03 | **Termin** | Rezerwacja w kalendarzu, może się nie odbyć | `:56` | **BRAK w kodzie** jako osobny byt. Szukano: `appointment`, `booking`, `reservation`, `slot`, `schedule`, `termin` w `src/main`. Rolę rezerwacji pełni `Visit` (UL-04) |
| UL-04 | **Wizyta** | Zdarzenie kliniczne z dokumentacją | `:56` | `Visit` (`owner/Visit.java:37`): data + jedno pole `description` (`:39-45`). Używane też jako rezerwacja, patrz BC-01 |
| UL-05 | **Przypadek** (epizod leczenia) | Kilka wizyt składających się na epizod | `:56` | **BRAK w kodzie**. Szukano: `case`, `episode`, `treatment`, `przypadek` |
| UL-06 | **Gatunek** | Słownikowy poziom klasyfikacji; od niego zależą dawki i normy | `:57` | Jako `PetType` (`owner/PetType.java:26-28`, tabela `types`, komentarz „Can be Cat, Dog, Hamster…” `:24`). Etykieta UI `type=Type` (`messages.properties:38`), czyli nazwa wprost odradzana w `:57` |
| UL-07 | **Rasa** | Drugi poziom słownika, zależny od gatunku; mieszaniec to pełnoprawna wartość | `:57` | **BRAK w kodzie**. Szukano: `breed`, `race`, `rasa`, `mixed` |
| UL-08 | **Pomiar masy ciała** | Wartość z datą, zapisana przy wizycie; podstawa dawek | `:58` | **BRAK w kodzie**. Szukano: `weight`, `mass`, `masa`, `kg` |
| UL-09 | **Data urodzenia (szacunkowa)** | Data urodzenia z oznaczeniem „szacunkowa”, a nie wiek | `:58` | `Pet.birthDate` (`owner/Pet.java:49-50`), wymagana (`owner/PetValidator.java:56-57`). Flagi „szacunkowa” brak |
| UL-10 | **Lekarz weterynarii / rola** | Rola personelu: lekarz, technik, recepcja | `:60` | `Vet extends Person` (`vet/Vet.java:45`). Ról brak: każdy `Vet` to lekarz |
| UL-11 | **Specjalizacja** | Np. kardiologia; wpływa na grafik i cennik | `:60` | `Specialty` (`vet/Specialty.java:29`), relacja M:N w `vet/Vet.java:47-50` |
| UL-12 | **Numer mikrochipa / paszportu** | Twarde identyfikatory (chip ma 15 cyfr), nie każde zwierzę je ma | `:83` | **BRAK w kodzie**. Szukano: `microchip`, `chip`, `passport` |
| UL-13 | **Numer karty pacjenta** | Wewnętrzny identyfikator pacjenta | `:83`, `:87` | Tylko techniczne `id` (`model/BaseEntity.java:35-37`). Numeru karty widocznego dla recepcji brak |
| UL-14 | **Status pacjenta (żyje / zmarł)** | Zmarli zostają w systemie i nie pojawiają się przy umawianiu | `:80`, `:91` | **BRAK w kodzie**. Szukano: `status`, `deceased`, `alive`, `dead`, `archived` (jedyne trafienie `status` jest w `templates/error.html:11`, to status HTTP) |
| UL-15 | **Przypomnienie** | Automatyczne przypomnienia o szczepieniach i kontrolach | `:11`, `:39-40` | **BRAK w kodzie**. Szukano: `reminder`, `notification`, `sms` |
| UL-16 | **Szczepienie, hospitalizacja, lek, zgoda, rozliczenie** | Procesy z `:15-19`, `:45-46` | `:15-19` | **BRAK w kodzie**. Szukano: `vaccin`, `hospital`, `drug`, `medic`, `consent`, `invoice`, `bill`, `payment` |

### Pojęcia, których kod naprawdę używa (zebrane bez patrzenia na wywiad)

| Termin w kodzie | Gdzie | Co znaczy w kodzie |
|---|---|---|
| `Owner` | `owner/Owner.java:50` | Osoba z adresem, miastem i 10-cyfrowym telefonem (`:52-65`). Korzeń agregatu dla zwierząt **i ich wizyt** (`addVisit`, `:176-186`) |
| `Pet` | `owner/Pet.java:46` | Byt nazwany (`NamedEntity`) z datą urodzenia, typem i zbiorem wizyt (`:49-59`) |
| `name` zwierzęcia | `owner/Owner.java:147-157`, `owner/PetController.java:111` | **Klucz wyszukiwania i unikalności** w obrębie właściciela, porównywany `equalsIgnoreCase` |
| `PetType` | `owner/PetType.java:28` | Płaski słownik nazw (`cat`, `dog`, `lizard`, `snake`, `bird`, `hamster` — `db/h2/data.sql:18-23`) |
| `Visit` | `owner/Visit.java:37` | Wpis z datą i opisem. Domyślnie „na jutro” (`:50-51`), data musi być w przyszłości (`owner/VisitController.java:100-101`), komunikat sukcesu „Your visit has been booked” (`:110`) |
| `Vet`, `Specialty`, `Vets` | `vet/` | Lista lekarzy ze specjalizacjami. `Vets` to tylko opakowanie do serializacji (`vet/Vets.java:24-31`) |
| `Person` | `model/Person.java:29` | Wspólna nadklasa `Owner` i `Vet`: imię, nazwisko |
| „Previous Visits”, „Pets and Visits” | `messages.properties:39`, `templates/pets/createOrUpdateVisitForm.html:45`, `templates/owners/ownerDetails.html:44` | Lista wizyt zwierzęcia pokazana jako „poprzednie” |

### Słowa o dwóch znaczeniach (kandydaci na granice kontekstów)

| ID | Słowo | Znaczenie A | Znaczenie B | Dowód | Konteksty |
|---|---|---|---|---|---|
| BC-01 | **Visit** | Rezerwacja na przyszłość: domyślnie jutro, data musi być > dziś, „has been booked” | Zapis kliniczny z opisem, pokazywany jako „Previous Visits” | `owner/Visit.java:50-51`, `owner/VisitController.java:100-101`, `:110` vs `owner/Visit.java:43-45`, `messages.properties:39` | **Kalendarz (Scheduling)** ↔ **Dokumentacja medyczna (Clinical Record)**. Wywiad wprost rozdziela Termin i Wizytę (`00-expert-interview.md:56`) |
| BC-02 | **Person** | Klient: płaci, decyduje, dostaje SMS | Pracownik przychodni (lekarz) | `owner/Owner.java:50` i `vet/Vet.java:45` dziedziczą z `model/Person.java:29` | **Klienci (Client Management)** ↔ **Personel i grafik (Staff)**. Wywiad: `User` to pracownik, a nie klient (`:55`) |
| BC-03 | **Owner** | Klient: osoba kontaktowa (adres, miasto, telefon); według wywiadu także płatnik i osoba podpisująca zgody | Kontener na dokumentację kliniczną: wizyty dodaje się przez `Owner.addVisit` | A: `owner/Owner.java:52-65`, `00-expert-interview.md:26`. B: `owner/Owner.java:176-186`, `owner/VisitController.java:108-109` | **Klienci** ↔ **Dokumentacja medyczna**. Historia choroby należy do pacjenta (`:25`), a nie do klienta. Przy zmianie właściciela (`:31`) historia nie może „wyjechać” z poprzednim klientem |
| BC-04 | **name** (imię zwierzęcia) | Kod: identyfikator (unikalny u właściciela, `getPet(String)`) | Wywiad: etykieta opisowa, zmienna i niestabilna w pisowni | `db/h2/schema.sql:55`, `owner/Owner.java:120-122` vs `00-expert-interview.md:66-70`, `:87` | To nie granica kontekstów, tylko **błędna rola pojęcia**: kod traktuje opis jako tożsamość |

## Krok 2 — Subdomeny

Brak PRD, więc uzasadnienia odwołują się do „Trzech kluczowych procesów” z wywiadu (`00-expert-interview.md:37-46`).

| ID | Obszar | Kategoria | Uzasadnienie | Stan w kodzie |
|---|---|---|---|---|
| SD-01 | Kalendarz wizyt i przypomnienia | **Core** | „Obłożenie gabinetów i lekarzy to nasz przychód… przypomnienia to główne źródło powracających klientów” (`:39-40`) | Szczątkowy: przyszła `Visit` bez lekarza, gabinetu i godziny (`db/h2/schema.sql:58-63`) |
| SD-02 | Dokumentacja medyczna wizyty | **Core** | Ciągłość leczenia, obowiązek prawny, obrona w razie skargi (`:42-43`) | Szczątkowy: jedno pole `description` 255 znaków (`owner/Visit.java:43-45`) |
| SD-03 | Rozliczenie i magazyn leków | **Core** | „Największe straty przychodni to rzeczy zrobione, ale niezaksięgowane” (`:45-46`) | Nieobecny (UL-16) |
| SD-04 | Rejestr pacjentów (identyfikacja, status, gatunek/rasa, masa) | **Supporting** | Nie daje przewagi sam w sobie, ale każdy proces Core wymaga jednoznacznego pacjenta (`:64-91`) | Częściowy: `Pet` + `PetType` |
| SD-05 | Rejestr klientów / opiekunów | **Supporting** | Potrzebny do zgód, płatności i SMS (`:26`, `:28-33`) | Częściowy: `Owner` jako jedna rola osoby fizycznej |
| SD-06 | Personel, role i specjalizacje | **Supporting** | Wpływa na grafik i cennik (`:60`), czyli zasila SD-01 i SD-03 | Częściowy: `Vet` + `Specialty`, bez ról |
| SD-07 | Słowniki (gatunek, rasa, specjalizacja) | **Generic** | Dane referencyjne, ale muszą być słownikowe, bo zależą od nich dawki (`:57`) | `PetType`, `Specialty` jako płaskie listy |
| SD-08 | Infrastruktura: i18n, cache, obsługa błędów, paginacja | **Generic** | Bez związku z domeną przychodni | `system/`, `messages*`, `CacheConfiguration` |

**Wniosek:** wszystkie trzy obszary Core istnieją w kodzie co najwyżej szczątkowo. Kod modeluje głównie Supporting (rejestr), a jedyny byt Core (`Visit`) łączy dwa konteksty (BC-01).

## Krok 3 — Kandydaci na agregaty i niezmienniki

Statusy: **egzekwuje** / **deklaruje** (komentarz, nazwa, brak egzekucji) / **ignoruje** (brak w kodzie) / **przeczy** (kod robi odwrotnie).

| ID | Agregat | Niezmiennik | Źródło | Status | Dowód |
|---|---|---|---|---|---|
| AGG-01 | **Pacjent** | I1: tożsamością jest techniczne ID, nie imię; imię nie jest unikalne nawet u jednego klienta | `00-expert-interview.md:87` | **przeczy** | Unikalność `(owner_id, name)` w trzech schematach: `db/h2/schema.sql:55`, `db/mysql/schema.sql:47`, `db/postgres/schema.sql:45` (z `LOWER(name)`); odrzucenie `duplicate` w `owner/PetController.java:111-113` i `:151-155`; zamiana wyjątku bazy na błąd formularza `:128-134`, `:202-205`. Historia (korekta K-01): odrzucanie `duplicate` przy dodawaniu jest od pierwszego importu (`521d01d`, 2009, `validation/PetValidator.java:21`), przy edycji od `3a61275` (2023-07-11), a ograniczenie w bazie od `e0db9b1` (2026-07-14). Żaden z tych commitów nie podaje uzasadnienia domenowego. ~~Wprowadzone świadomie w `e0db9b1`~~ |
| AGG-01 | Pacjent | I2: podobne imię u tego samego klienta → ostrzeżenie, nie blokada | `:89` | **przeczy** | Ten sam dowód: zapis jest blokowany |
| AGG-01 | Pacjent | I3: zmarły pacjent zostaje w systemie z wyraźnym statusem i nie pojawia się przy umawianiu | `:91` | **ignoruje** | UL-14 |
| AGG-01 | Pacjent | I4: data urodzenia może być szacunkowa | `:58` | **częściowo przeczy** | `birthDate` wymagana (`owner/PetValidator.java:56-57`) bez flagi „szacunkowa”, więc przy nieznanej dacie recepcja musi wpisać datę zmyśloną |
| AGG-02 | **Opiekun / Klient** | I5: pacjent może mieć kilku opiekunów i zmienić właściciela | `:30-31` | **przeczy** | Jedno `owner_id` w `pets` (`db/h2/schema.sql:51`), `Owner.pets` jako `@OneToMany` (`owner/Owner.java:67-70`). Brak operacji przeniesienia |
| AGG-02 | Opiekun | I6: klientem może być firma, fundacja, gmina; przyprowadzający ≠ płacący | `:32-33` | **ignoruje** | `Owner extends Person` (imię + nazwisko obowiązkowe, `model/Person.java:31-39`) |
| AGG-03 | **Wizyta** (zdarzenie kliniczne) | I7: wizyta może się odbyć bez wcześniejszej rezerwacji (nagły przypadek) | `:56` | **przeczy** | Zapis odrzuca każdą datę ≤ dziś (`owner/VisitController.java:100-101`, komunikat „Visit date must be in the future”, `messages.properties:9`). Nagłego przypadku z dziś ani odbytej wizyty nie da się zapisać. Wprowadzone w `753d35c` („Validate future visit dates”) |
| AGG-03 | Wizyta | I8: dokumentacja obejmuje wywiad, badanie, rozpoznanie, zalecenia, leki | `:43` | **ignoruje** | Jedno pole `description` (`owner/Visit.java:43-45`) |
| AGG-03 | Wizyta | I9: historia choroby należy do pacjenta | `:25` | **deklaruje** | `visits.pet_id` (`db/h2/schema.sql:60`) poprawnie wiąże z pacjentem, ale wejście idzie przez `Owner.addVisit` (`owner/Owner.java:176-186`), więc korzeniem jest klient (BC-03) |
| AGG-04 | **Termin** | I10: termin może się nie odbyć i nie zaśmieca historii choroby | `:56` | **ignoruje** | UL-03. Dziś każdy „termin” trafia do historii jako `Visit` |
| AGG-04 | Termin | I11: termin rezerwuje lekarza/gabinet (obłożenie = przychód) | `:40` | **ignoruje** | `visits` nie ma `vet_id` ani godziny (`db/h2/schema.sql:58-63`) |
| AGG-05 | **Pomiar masy ciała** | I12: pomiar z datą, przy wizycie; nie nadpisuje się | `:58` | **ignoruje** | UL-08. Kod niczego nie nadpisuje, bo w ogóle nie ma tego pola |
| AGG-06 | **Słownik gatunek → rasa** | I13: rasa zależy od gatunku; dane słownikowe, nie tekst | `:57` | **częściowo egzekwuje** | Gatunek jest słownikiem z FK (`db/h2/schema.sql:50`, `:54`; parsowanie tylko znanych wartości w `owner/PetTypeFormatter.java:52-59`). Rasy brak |

## Krok 4 — Rozjazdy MODEL vs KOD

„Co naprawić”: **kod**, **dokument** (tylko gdy da się zacytować późniejszą decyzję) albo **decyzja** (właściciel rozstrzyga, kto ma rację).

| ID | Dokument mówi | Kod robi | Dowód | Co naprawić |
|---|---|---|---|---|
| DR-01 | Imię nie identyfikuje pacjenta i nie jest unikalne; podobne imię → ostrzeżenie, bez blokady (`00-expert-interview.md:66-70`, `:87`, `:89`) | Unikalność `(owner_id, name)` na poziomie bazy i kontrolera, bez względu na wielkość liter | `db/h2/schema.sql:55`, `db/mysql/schema.sql:47`, `db/postgres/schema.sql:45`, `owner/PetController.java:111-113`, `:151-155` | **Decyzja**: reguła jest w repo od 2009 r. i była trzykrotnie wzmacniana (`521d01d` → `3a61275` → `e0db9b1`, K-01), ale żaden commit nie podaje uzasadnienia. ~~commit `e0db9b1` jest świadomy, ale bez uzasadnienia~~. Wywiad jest jedynym źródłem domenowym (nie jest w historii gita, więc nie da się ustalić, czy powstał przed tym commitem, czy po nim). **Pilne:** aktywny plan `context/changes/refactor-opportunities/plan.md` (status `plan_reviewed`) przenosi tę regułę do agregatu `Owner`, czyli **utrwala** zachowanie sprzeczne z domeną. Q-01, Q-02 |
| DR-02 | Wizyta i termin to dwa byty; nagły przypadek bez rezerwacji musi pasować do modelu (`:56`) | Jedna `Visit` jako rezerwacja (tylko przyszłe daty, „booked”) i jako historia („Previous Visits”) | `owner/VisitController.java:100-101`, `:110`, `owner/Visit.java:50-51`, `messages.properties:39` | **Decyzja**, potem kod. Q-03 |
| DR-03 | Historia choroby należy do pacjenta; pacjent może zmienić właściciela (`:25`, `:31`) | Wizyty dodawane przez korzeń `Owner`; pacjent ma jedno `owner_id`, brak przeniesienia | `owner/Owner.java:176-186`, `db/h2/schema.sql:51` | **Decyzja** (zakres modelu opiekunów). Q-04 |
| DR-04 | Recepcja szuka klienta po telefonie lub nazwisku, potem pacjenta po imieniu; wyszukiwanie ignoruje wielkość liter i diakrytyki (`:74`, `:88`) | Klient tylko po prefiksie nazwiska; brak wyszukiwania pacjenta i po telefonie; porównanie imion `equalsIgnoreCase` (bez diakrytyków) | `owner/OwnerRepository.java:45`, `owner/OwnerController.java:141-145`, `owner/Owner.java:150` | **Kod** |
| DR-05 | Zmarli pacjenci mają status i znikają z umawiania (`:80`, `:91`) | Brak statusu | UL-14 | **Kod** |
| DR-06 | Masa ciała jako historia pomiarów; data urodzenia z flagą „szacunkowa” (`:58`) | Brak masy; `birthDate` wymagana, bez flagi | `owner/Pet.java:49-50`, `owner/PetValidator.java:56-57` | **Kod** |
| DR-07 | Gatunek i rasa to dwa poziomy słownika; nie nazywać `Type` (`:57`) | Jeden poziom `PetType`, etykieta „Type” | `owner/PetType.java:28`, `messages.properties:38` | **Kod** (rasa), nazewnictwo: decyzja (Q-05) |
| DR-08 | Mikrochip, paszport, numer karty pacjenta (`:83`) | Tylko techniczne `id` | `model/BaseEntity.java:35-37` | **Kod** |
| DR-09 | Wizyta ma lekarza; obłożenie lekarzy to przychód (`:40`) | `visits` bez lekarza i godziny | `db/h2/schema.sql:58-63` | **Kod** (w ramach AGG-04) |
| DR-10 | Rola (lekarz, technik, recepcja) ≠ specjalizacja (`:60`) | Każdy `Vet` to lekarz; są tylko specjalizacje | `vet/Vet.java:45-50` | **Kod**, niski priorytet |
| DR-11 | Nazwy `Pet`, `Owner` jako jedyna rola, `Type` są mylące (`:54-57`) | Właśnie tych nazw używa kod, schemat i UI | `owner/Pet.java:46`, `owner/Owner.java:50`, `owner/PetType.java:28` | **Decyzja**: rename całego sample'a to osobna, kosztowna zmiana. Q-05 |

## Krok 5 — Ranking refaktoru

Wartość = jak rdzeniowy jest niezmiennik (SD Core > Supporting). Ryzyko = jak słabo jest dziś egzekwowany (przeczy > ignoruje > deklaruje).

| Miejsce | Kandydat | Wartość | Ryzyko | Uzasadnienie | Gotowe, gdy… |
|---|---|---|---|---|---|
| **#1** | **AGG-01 Pacjent: imię nie jest tożsamością** (DR-01) | Wysoka: każdy proces Core zaczyna się od jednoznacznego pacjenta | **Najwyższe**: kod aktywnie przeczy domenie w trzech warstwach (schemat, kontroler, obsługa wyjątku) i blokuje typowy scenariusz recepcji: nowy pies o imieniu zmarłego. Do tego aktywny plan właśnie utrwala sprzeczną regułę | Najtańszy do domknięcia, a największa szkoda, jeśli plan pójdzie dalej | Test MockMvc dodający drugiego pacjenta „Zoe” u tego samego klienta kończy się redirectem i zapisem, a `rg -n unique_owner_pet_name src/main` nic nie zwraca |
| #2 | **AGG-03 / AGG-04 Wizyta vs Termin** (DR-02, DR-09) | Najwyższa: SD-01 i SD-02, oba Core | Wysokie: kod przeczy I7 (nagły przypadek niemożliwy) | Większy zakres i wymaga decyzji Q-03; nie da się go zrobić małym krokiem bez rozdzielenia bytów | Test zapisujący wizytę z datą dzisiejszą przechodzi, a `rg -n "class (Appointment\|Termin)" src/main` znajduje dokładnie jedną klasę |
| #3 | **AGG-01 Pacjent: status zmarły** (DR-05) | Średnia (Supporting, ale chroni SD-01: brak SMS do zmarłych) | Średnie: ignoruje | Mały, addytywny krok; naturalnie po #1 | Test listy pacjentów do umówienia nie zwraca pacjenta oznaczonego jako zmarły |
| #4 | **AGG-02 Opiekun: wielu opiekunów, zmiana właściciela** (DR-03) | Średnia | Wysokie (przeczy), ale zależne od decyzji | Duża zmiana modelu; najpierw Q-04 | Test przenosi pacjenta do innego klienta, a jego wizyty są nadal widoczne w historii pacjenta |
| #5 | **AGG-05 Pomiar masy + data szacunkowa** (DR-06) | Średnia (dawki leków, SD-02) | Niskie: ignoruje, niczego nie psuje | Addytywne, bez ryzyka regresji | Test zapisuje dwa pomiary masy dla jednego pacjenta i oba są zwracane w kolejności dat |
| #6 | **AGG-06 Gatunek → Rasa** (DR-07) | Niska–średnia | Niskie: gatunek jest już słownikiem | Rozszerzenie słownika | Zapis pacjenta z rasą niepasującą do gatunku jest odrzucany przez test walidacji |

**#1 do refaktoru: AGG-01, imię nie jest tożsamością pacjenta.** Kod nie tylko pomija tę regułę, lecz wprost robi odwrotnie w schemacie, kontrolerze i obsłudze wyjątków. Do tego jedyny aktywny plan zmiany w repo ją cementuje. Najpierw trzeba rozstrzygnąć Q-01 i Q-02. Do tego czasu plan `refactor-opportunities` powinien poczekać, bo przenosi do agregatu regułę, którą domena odrzuca.

### Pytania do właściciela

| ID | Pytanie | Kto zna odpowiedź |
|---|---|---|
| Q-01 | Czy unikalność imienia u właściciela (obecna od `521d01d`, 2009, wzmocniona w `3a61275` i `e0db9b1`) to reguła domenowa, czy tylko uproszczenie przykładowej aplikacji? Czy było zgłoszenie (issue), które ją uzasadnia? | Maintainer repo |
| Q-02 | Czy wstrzymujemy plan `context/changes/refactor-opportunities/plan.md` do rozstrzygnięcia DR-01, czy kończymy go jako czysty refaktor i dopiero potem zmieniamy regułę? | Tech lead (właściciel zmiany) |
| Q-03 | Czy dopuszczamy wpis wizyty z datą dzisiejszą lub wsteczną (nagły przypadek, dopisanie po fakcie)? Czy rozdzielamy Termin od Wizyty już w tym cyklu? | Menadżer przychodni |
| Q-04 | Czy w najbliższym cyklu wspieramy wielu opiekunów i przeniesienie pacjenta, czy zostajemy przy jednym właścicielu? | Menadżer przychodni / product owner |
| Q-05 | Czy zmieniamy nazwy w kodzie (`Pet` → `Patient`, `PetType` → `Species`, `Owner` → `Client`), czy zostawiamy je i opisujemy tylko w słowniku? | Tech lead |

## Weryfikacja raportu (przebieg 2, 2026-11-23)

Przegląd bez zmian w kodzie. Raport poprawiono tylko tam, gdzie są dowody; wcześniejsze sformułowania zostały przekreślone, a nie usunięte.

### 1. Pojęcia „BRAK w kodzie” i zakres wyszukiwania

| ID | Pojęcie | Szukane warianty i synonimy |
|---|---|---|
| UL-03 | Termin | `appointment`, `booking`, `reservation`, `slot`, `schedule`, `termin` |
| UL-05 | Przypadek | `case`, `episode`, `treatment`, `przypadek` |
| UL-07 | Rasa | `breed`, `race`, `rasa`, `mixed` |
| UL-08 | Pomiar masy ciała | `weight`, `mass`, `masa`, `kg` |
| UL-12 | Mikrochip / paszport | `microchip`, `chip`, `passport` |
| UL-14 | Status pacjenta | `status`, `deceased`, `alive`, `dead`, `archived` |
| UL-15 | Przypomnienie | `reminder`, `notification`, `sms` |
| UL-16 | Szczepienie, hospitalizacja, lek, zgoda, rozliczenie | `vaccin`, `hospital`, `drug`, `medic`, `consent`, `invoice`, `bill`, `payment` |

Zakres pierwszego przebiegu: `grep -rniE` po `src/main/java`, `templates`, `db/h2`, `messages.properties`. Trafienia `case` i `status` to wyłącznie `th:case` i status HTTP (`templates/error.html:11-14`, `templates/fragments/inputField.html:13-14`).

**Kontrola klasycznym grepem po całym `src/` (z testami, CSS i SCSS):**

| Pojęcie | Polecenie | Wynik | Werdykt |
|---|---|---|---|
| UL-08 masa ciała | `grep -rn -i "weight" src/` | Same `font-weight` w `static/resources/css/petclinic.css` i `scss/typography.scss`, zero w Javie, SQL i szablonach | ✅ BRAK (trafienia to CSS) |
| UL-12 mikrochip | `grep -rn -i "microchip\|chip" src/` | 0 trafień (exit 1) | ✅ BRAK |
| UL-03 termin | `grep -rn -i "appointment\|booking\|reservation" src/` | 0 trafień (exit 1) | ✅ BRAK |

### 2. Słowa o wielu znaczeniach — dowody z obu kontekstów

| ID | Kontekst A | Kontekst B | Werdykt |
|---|---|---|---|
| BC-01 `Visit` | Rezerwacja: `owner/Visit.java:50-51`, `owner/VisitController.java:100-101`, `:110` | Zapis kliniczny: `owner/Visit.java:43-45`, `messages.properties:39` | ✅ oba |
| BC-02 `Person` | Klient: `owner/Owner.java:50` | Pracownik: `vet/Vet.java:45` (wspólna nadklasa `model/Person.java:29`) | ✅ oba |
| BC-03 `Owner` | ~~brak plik:linia dla znaczenia A~~ → **poprawione**: `owner/Owner.java:52-65` (dane kontaktowe), `00-expert-interview.md:26` | Kontener wizyt: `owner/Owner.java:176-186`, `owner/VisitController.java:108-109` | ✅ po korekcie K-02 |
| BC-04 `name` | Identyfikator: `db/h2/schema.sql:55`, `owner/Owner.java:120-122` | Etykieta: `00-expert-interview.md:66-70`, `:87` | ✅ oba |

### 3. Rozjazdy oznaczone „naprawić dokument”

Żaden rozjazd (DR-01…DR-11) nie ma oznaczenia „dokument”: wszystkie to „kod” albo „decyzja”. Nie było czego zamieniać na „decyzja dla właściciela”. Bez zmian.

### 4. Porównanie z `context/changes/pet-duplicate-name-analysis/research.md`

Reguła unikalności imienia u właściciela **jest** w destylacji (AGG-01 I1–I2, DR-01, ranking #1). Ranking zostaje bez zmian. Porównanie dało dwie korekty i kilka obserwacji.

**Korekty (z dowodem):**

| ID | Było | Jest | Dowód |
|---|---|---|---|
| K-01 | Reguła „wprowadzona świadomie w `e0db9b1`” | Odrzucanie `duplicate` przy dodawaniu jest od `521d01d` (2009), przy edycji od `3a61275` (2023-07-11), ograniczenie w bazie od `e0db9b1` (2026-07-14) | `git grep duplicate 521d01d` → `validation/PetValidator.java:21`; `git log -S'"duplicate"'`; research.md:244 („sprawdzenie w pamięci i kod `duplicate` są w repo od `3a61275`”) |
| K-02 | BC-03 bez plik:linia dla znaczenia „klient” | Dodano `owner/Owner.java:52-65` | sekcja 2 wyżej |

K-01 częściowo koryguje też research: twierdzi on, że sprawdzenie w pamięci jest od `3a61275` (research.md:244, :312), a dla dodawania jest ono starsze (`521d01d`).

**Obserwacje (bez zmiany rankingu):**

- **O-01. Research traktuje regułę jako daną domenową, a nie hipotezę.** Nazywa ją „regułą domenową w kontrolerze” (research.md:169, D8) i analizuje tylko to, jak dobrze jest egzekwowana: dwie linie obrony (:282), wyścig check-then-act (:40), różnice baz (:98-104). Nigdzie nie pyta, czy reguła jest prawdziwa w domenie. Destylacja konfrontuje ją z wywiadem (`00-expert-interview.md:87`, `:89`) i wychodzi „przeczy”. Na researchu opiera się plan `refactor-opportunities`, więc ten brak przeniósł się do planu (Q-02).
- **O-02. Koszty egzekwowania reguły, których destylacja nie wymienia.** Według research: na MySQL ograniczenie nie ma nazwy, więc duplikat wykryty przez bazę najpewniej daje stronę błędu 500 (research.md:44, :104, [I/U1]); brak narzędzia migracji sprawia, że stare bazy MySQL mogą nie mieć ograniczenia, a Postgres może nie wystartować przy istniejących duplikatach (:167, D6, [I]); binder `*.id` pozwala obejść sprawdzenie w pamięci spreparowanym `pets[n].name` (:170, D9, [I]). To dodatkowe argumenty dla #1: reguły, której domena nie chce, kod pilnuje kosztownie i niespójnie między bazami.
- **O-03. Research nie zna wywiadu.** Jego „Historical Context” mówi, że jedynym kontekstem jest mapa repo (research.md:286-288). Wywiad (`00-expert-interview.md`) nie był wtedy materiałem źródłowym. Rozbieżność wynika z innego zestawu źródeł, a nie z błędu którejś analizy.
