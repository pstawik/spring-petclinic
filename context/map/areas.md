# Wspólna lista obszarów mapy

Słownik obszarów dla `artifact-1-territory.md` (T1), `artifact-2-structure.md` (T2) i `artifact-3-contributors.md` (T3). Kod produktu jest taki sam w stanach `527d61b`, `28c6411` i `be1eb26` (od `527d61b` zmieniały się tylko `context/` i `AGENTS.md`).

Ścieżki Java są względne do `org/springframework/samples/petclinic/` w `src/main/java` i `src/test/java`. Kod main i testy jednej funkcji należą do tego samego obszaru.

## Obszary

| ID | Funkcja produktu | Ścieżki |
|----|------------------|---------|
| A1 | **Właściciele:** wyszukiwanie z paginacją, rejestracja, edycja, szczegóły | `owner/Owner*` (w tym `OwnerController`, `OwnerRepository`), `templates/owners/` |
| A2 | **Zwierzęta:** dodawanie i edycja, typy, unikalne imię u właściciela | `owner/Pet*` (w tym `PetController`, `PetValidator`, `PetType*`), `templates/pets/createOrUpdatePetForm.html` |
| A3 | **Wizyty:** rejestrowanie wizyty zwierzęcia | `owner/Visit*`, `templates/pets/createOrUpdateVisitForm.html` |
| A4 | **Weterynarze:** lista z paginacją, API JSON/XML, cache `"vets"` | `vet/`, `templates/vets/` |
| A5 | **Model wspólny:** `BaseEntity`, `NamedEntity`, `Person` | `model/` |
| A6 | **Schemat i dane baz** (H2, MySQL, PostgreSQL) | `src/main/resources/db/{h2,mysql,postgres}/`, `application-{mysql,postgres}.properties` |
| A7 | **Interfejs wspólny i i18n:** powitanie, błędy, layout, fragmenty formularzy, cache, `?lang=` | `system/`, `templates/{fragments/,welcome.html,error.html}`, `src/main/resources/messages/` |
| A8 | **Start i obraz natywny** | `PetClinicApplication`, `PetClinicRuntimeHints` |
| P1 | **Platforma (nie funkcja produktu):** build, wrappery, globalne JPA, testy integracyjne | `pom.xml`, `build.gradle`, wrappery, `application.properties`, `PetClinicIntegrationTests`, `PetClinicConcurrencyTests`, `MySqlIntegrationTests`, `MysqlTestApplication`, `PostgresIntegrationTests`, `service/ClinicServiceTests` |

`service/ClinicServiceTests` należy do P1, bo testuje repozytoria A1, A2 i A4 na H2. W T1 był liczony osobno jako `service/`.

## Tematy przekrojowe

Te tematy nie są obszarami. Każdy łączy kilka obszarów.

| ID | Temat | Obszary | Główne miejsca |
|----|-------|---------|----------------|
| X1 | Unikalne imię zwierzęcia u właściciela | A2, A6, P1 | `PetController` (`isDuplicatePetNameViolation`, napis `unique_owner_pet_name`), indeks w trzech `schema.sql`, `PetClinicConcurrencyTests`. **Nie** `PetValidator` ani `Pet.java` (`git show --stat e0db9b1`). |
| X2 | Walidacja zgodna z długością kolumn | A1, A2, A3, A5, A6 | `@Size` w `Owner`, `Visit`, `Person`; limit imienia w `PetValidator`; kolumny w trzech `schema.sql` |
| X3 | Paginacja i granice wejścia | A1, A4 | `OwnerController` i `VetController` (skopiowana logika) |
| X4 | Binder (`setDisallowedFields`) | A1, A2, A3 | trzy kontrolery w `owner/` |

## Jak nazwy z artefaktów przechodzą na tę listę

| T1 (obszar) | T2 (pakiet lub klasa) | T3 (obszar) | Tu |
|-------------|-----------------------|-------------|----|
| Właściciele | `owner.Owner`, `OwnerController`, `OwnerRepository` | 2 `Owner` | A1 |
| Zwierzęta | `owner.Pet`, `PetController`, `PetValidator`, `PetType*` | 3 unikalność (częściowo) | A2, X1 |
| Wizyty | `owner.Visit`, `VisitController` | – (uzupełnienie w T3 §2a) | A3 |
| Weterynarze `vet/` | pakiet `vet` | – (T3 §2a) | A4 |
| Model bazowy `model/` | pakiet `model` | 4 walidacja (częściowo) | A5, X2 |
| Skrypty baz `db/` | poza jdeps (U19, U23–U26) | 1 `db/` | A6 |
| System + Tłumaczenia | pakiet `system`, poza jdeps (U15–U17) | – (T3 §2a) | A7 |
| Korzeń aplikacji | korzeń (`PetClinicRuntimeHints`) | – (T3 §2a) | A8 |
| Testy integracyjne, `service/` | testy (`tf`) | – (T3 §2a) | P1 |
| (odfiltrowane jako szum) | – | 5 build | P1 |
