# Reguła unikalności imienia zwierzęcia jako metoda agregatu `Owner` — Plan Brief

> Full plan: `context/changes/refactor-opportunities/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

Z rankingu refactor opportunities realizujemy tylko pozycję **#1** (C3 + C4): regułę „imię zwierzęcia jest unikalne u ownera” przenosimy z `PetController` do jednej metody zapytania na agregacie `Owner`. Dziś reguła istnieje w dwóch wariantach w kontrolerze, a poprawność edycji zależy po cichu od `open-in-view=false` i od kolejności zwierząt na liście. Jedyny test tego przypadku przechodzi tylko dzięki kolejności w fixture.

## Starting Point

`PetController.java:111` (dodawanie) i `:151-155` (edycja) korzystają z `Owner.getPet(String, boolean)`, które zwraca **pierwsze** trafienie. Dodawanie pomija niezapisane zwierzęta, a edycja je liczy. Testy MockMvc używają jednej instancji `Owner`, natomiast produkcja z `open-in-view=false` dostaje dwie osobne kopie.

## Desired End State

`Owner.hasOtherPetNamed(name, excludedPetId, includeUnsaved)` jest jedynym źródłem reguły, z dzisiejszą semantyką pierwszego trafienia. Kontroler tylko mapuje `true` na błąd `duplicate`. Zachowanie bez zmian; niezależność edycji od kolejności listy i OSIV (C4) domyka osobna, kolejna zmiana. Kontrakt HTTP, `schema.sql`, `messages*` i publiczne `getPet(...)` zostają bez zmian.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Gdzie żyje reguła | Agregat `Owner`, bez serwisu | Brak serwisów to decyzja nośna (`83ff9a5`, `c953442`, `4725753`) | Research |
| Zakres | Tylko #1; #2 i #3 jako osobne zmiany | #2 i #3 zmieniają obserwowalne zachowanie i zależą od U1, U-OLD, U-D9 | Plan |
| Kształt metody | Zapytanie `boolean`, kontroler robi `rejectValue` | Zmiana addytywna, `addPet` i kontrakt HTTP bez zmian, precedens `O:108` | Plan |
| Niezapisane zwierzęta | Zachować obie semantyki (`includeUnsaved`) | Zero zmiany zachowania w refaktorze (hard rule) | Plan |
| Pierwsze vs wszystkie trafienia | Plan wiernie „pierwsze”; „wszystkie” jako osobna, kolejna zmiana | Twarda reguła: faza zmieniająca obserwowalne zachowanie to osobna zmiana | Plan-review F1 |
| `getPet(String…)` | Zostaje w publicznym API | Używa go 5 miejsc w testach, mniejszy diff w hubie `Owner` | Plan |
| Guard | Fixture ze świeżą instancją `Owner` na każde `findById` | Odwzorowuje produkcję i jest odporny na kolejność, więc przypina zachowanie, a nie przypadek | Plan |

## Scope

**In scope:**
- Testy charakteryzujące w `OwnerTests` i `PetControllerTests`
- Nowa metoda `Owner.hasOtherPetNamed`
- Przepięcie obu handlerów `PetController`

**Out of scope:**
- #2 (nazwa ograniczenia, MySQL), #3 (bindery)
- „Wszystkie trafienia” (domknięcie C4) — osobna, kolejna zmiana (szkic na końcu planu)
- C2, C6, C7, C8
- Ujednolicenie semantyki niezapisanych zwierząt
- Serwisy, `@Transactional`, zmiany OSIV, schematu i `messages*`
- Test `@SpringBootTest` z OSIV=true

## Architecture / Approach

Branch by Abstraction na agregacie. Kolejność kroków: guard, nowa metoda obok starej (nieużywana), przepięcie edycji, przepięcie dodawania. Każda faza to osobny commit odwracalny niezależnie i żadna nie zmienia zachowania.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Testy charakteryzujące | Przypięta semantyka `getPet(String, boolean)` i kontrakt HTTP na produkcyjnym wariancie fixture | Fixture z jedną instancją myli zachowanie z przypadkiem kolejności |
| 2. Nowa metoda (pierwsze trafienie) | `hasOtherPetNamed` równoważna obu wariantom, nieużywana | Nieścisła równoważność przy `id == null` |
| 3. Przepięcie edycji | `PC:151-155` woła agregat, znika import `Objects` | Checkstyle i javaformat |
| 4. Przepięcie dodawania | `PC:111` woła agregat, reguła ma jedno źródło | Zgubiony warunek `pet.isNew()` |

**Prerequisites:** JDK i Maven wrapper działają lokalnie (`./mvnw -B verify` zielone na `main`). Docker niepotrzebny.
**Estimated effort:** ~1 sesja, 4 małe fazy (S).

## Open Risks & Assumptions

- Kolejna zmiana („wszystkie trafienia”) zmieni zachowanie w przypadku brzegowym. Przy `open-in-view=false` dotyczy to tylko list, które już zawierają dwa imiona równe bez względu na wielkość liter, albo spreparowanych `pets[n]`. Skalę na realnych bazach rozstrzygnęłyby U-VAR i U-OLD. Do tego czasu przypięty test z fazy 2 dokumentuje zależność od kolejności.
- Zakładamy, że `@ModelAttribute` `findOwner` i `findPet` wywołują `findById` osobno, więc w produkcji dostają różne kopie. Test ze świeżą instancją na każde wywołanie nie zależy od kolejności tych wywołań.
- U-D9 (binding `pets[n]`) zostaje nierozstrzygnięte. Plan go nie wymaga, ale #3 tak.

## Success Criteria (Summary)

- Dodawanie i edycja na zajęte imię (także inną wielkością liter) dają błąd przy polu imienia, a edycja na własne imię się zapisuje, przed refaktorem i po nim.
- `PetController` nie zawiera logiki reguły, a `./mvnw -B verify` jest zielone po każdej fazie.
