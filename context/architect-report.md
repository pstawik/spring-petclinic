---
title: Raport architektoniczny — moduł 4 (10xArchitect)
created: 2026-11-23
type: architect-report
---

# Raport architektoniczny — moduł 4

Raport powstał wyłącznie z artefaktów w `context/`. Skróty: **MAP** = `context/map/repo-map.md`, **R3** = `context/changes/pet-duplicate-name-analysis/research.md`, **R4** / **P4** = `context/changes/refactor-opportunities/research.md` / `plan.md`, **D1–D3** = `context/domain/01-…`, `02-…`, `03-…`.

## 1. Opisane projekty

| Artefakt | Repozytorium | Stan kodu |
|---|---|---|
| L2 — MAP | spring-petclinic | `ff2b1ec`, okno historii 2025-11-20 → 2026-11-20 |
| L3 — R3 | spring-petclinic | `d508ed7` |
| L4 — R4, P4 | spring-petclinic | `939a56d` |
| L5 — D1, D2, D3, `glossary.md` | spring-petclinic | 2026-11-23; kod produktu bez zmian od `500158f` (R3, R4) |

**Jeden projekt we wszystkich lekcjach:** Spring PetClinic, przykładowa aplikacja Spring Boot 4.1 (Java 17, Spring Data JPA, Thymeleaf), działająca na H2, MySQL i PostgreSQL (MAP §1).

**Skala orientacyjnie:**
- 4 pakiety funkcji: `owner`, `vet`, `system`, `model`,
- schemat w 3 dialektach SQL,
- 28 commitów po filtrach w rocznym oknie, z czego 14 w `owner/` (MAP §1, §7).

## 2. Mapa projektu (L2)

- **Ryzyko leży poza Javą.** Graf typów jest czysty (0 cykli), ale trzy ręcznie synchronizowane `schema.sql`, reguły zapisane jako napisy i konfiguracja Springa są dla jdeps niewidoczne. Jedyna regresja w oknie (`88e37c1`) przyszła z SQL (MAP §1, strefa 1).
- **Lokalne centrum: agregat `Owner`.** Trzy funkcje (właściciele, zwierzęta, wizyty) mają jedną ścieżkę zapisu przez `OwnerRepository` i kaskadę JPA; nie ma `PetRepository` ani `VisitRepository`. Pakiet wygląda na liść (I = 1,00), ale w środku ma centrum grafu (`Owner`, `Pet`: Ca 4) (MAP §2, strefa 2).
- **Cztery strefy ryzyka:** zgodność baz, zapis przez `Owner`, unikalne imię zwierzęcia, niedziałająca konfiguracja cache weterynarzy. Piąta (granice wejścia) zeszła do „śladu w historii”, bo poprawki z 2026 mają już testy (MAP §4, §7).
- **Entry pointy, od których zaczynać:** kontrolery `owner/` (`PetController` ma najwyższe Ce = 6 i logikę domenową) oraz skrypty `schema.sql` wykonywane przy każdym starcie na MySQL i Postgresie (`sql.init.mode=always`) (MAP §4, §6).
- **Najważniejsze niewiadome:** czy duplikat imienia na MySQL kończy się błędem 500 oraz czy `/vets` w ogóle zwraca XML. Pełna lista niewiadomych to U1–U36 (MAP §7). Pierwszą rozstrzygnął L5 w części dotyczącej nazwy: nienazwany klucz MySQL nazywa się `owner_id` (D3, Krok 5).

## 3. Analiza ficzera (L3)

**Przepływ:** zapis zwierzęcia z imieniem, które ma już inne zwierzę tego samego właściciela, przy dodawaniu i edycji. Wybór wynika ze strefy ryzyka 3 z mapy: reguła rozpoznaje naruszenie po napisie z komunikatu bazy (R3, Research Question).

**Feature overview:** Input to formularz HTTP (`POST /owners/{id}/pets/new` lub `…/edit`), wiązany do encji `Pet` i sprawdzany przez `PetValidator`. Linia P1 sprawdza duplikat w pamięci na agregacie `Owner` (`equalsIgnoreCase`). Stan zmienia się w `owners.saveAndFlush(owner)` przez kaskadę na `pets`. Linia P2, czyli ograniczenie w bazie, łapie to, co P1 przepuściła. Na wyjściu użytkownik dostaje redirect, formularz z błędem `duplicate` albo, gdy napis w komunikacie nie pasuje, stronę błędu 500 (R3, Summary, §1.2–1.3).

**Najważniejszy dług techniczny:**
1. **Kruche sprzężenie przez napis.** `PetController` porównuje komunikat wyjątku z `unique_owner_pet_name`. Nazwę ograniczenia mają tylko H2 i Postgres; na MySQL nie ma jej wcale (R3 D1, S1).
2. **Luki testowe.** Testy kontrolera podstawiają wymyślony komunikat, test współbieżności działa tylko na H2 i nie odróżnia błędu formularza od 500. 5 z 10 niepokrytych gałęzi `PetController` leży na tej ścieżce (R3 §2.3).
3. **Blast radius poza kontrolerem — potwierdzone ast-grepem.** W `src/main` jest 5 wywołań zapisu przez `OwnerRepository`, a sprawdzenie duplikatu poprzedza tylko 2. Pozostałe 3 zapisują kaskadowo z binderem blokującym wyłącznie `id` (R3 Summary, D9). Także ast-grepem potwierdzone: dwa identyczne bloki `catch` w `PetController` (R4 W1/W2). L5 potwierdził obejście w działaniu na H2 (D2, „Konfrontacja”).

## 4. Plan refaktoryzacji (L4)

**Co refaktoryzujemy:** pozycję #1 rankingu (C3 + C4). Reguła unikalności imienia przechodzi z `PetController` do jednej metody zapytania na agregacie, `Owner.hasOtherPetNamed(name, excludedPetId, includeUnsaved)`. Metoda wiernie zachowuje dzisiejszą semantykę pierwszego trafienia. Kontroler tylko mapuje `true` na błąd `duplicate`. Podejście: Branch by Abstraction, bez warstwy serwisów (P4 Overview, Desired End State).

**Czego świadomie nie robimy:**
- #2 (nazwa ograniczenia w MySQL) i #3 (allow-lista binderów): zmieniają zachowanie.
- „Wszystkie trafienia”: osobna, kolejna zmiana.
- C2 (relacja równoważności imion) i C7 (narzędzie migracji).
- Zmiany OSIV, schematu, `messages*`, serwisy (P4 „What We're NOT Doing”).

**Fazy** (każda to osobny commit, odwracalny niezależnie; P4 Progress):

| Faza | Co robi | Weryfikacja |
|---|---|---|
| 1 | Testy charakteryzujące (`OwnerTests`, `PetControllerTests` z osobnymi instancjami `Owner`) | auto: `-Dtest=…`, `verify`, diff tylko w `src/test` |
| 2 | Nowa `hasOtherPetNamed` obok starej, nieużywana | auto: testy jednostkowe, `PetController` bez zmian (`git diff --quiet`) |
| 3 | Przepięcie edycji | auto: testy, `verify`, grep bez `Objects`; ręcznie: edycja w działającej aplikacji |
| 4 | Przepięcie dodawania | auto: testy, `verify`, grep bez `getPet(String, boolean)`; ręcznie: dodanie w aplikacji |

Status: plan po plan-review (werdykt SOUND), implementacja niewykonana (wszystkie pozycje Progress `[ ]`).

## 5. Domena wg DDD (L5)

**Ubiquitous language** (`glossary.md`, D1 Krok 1):
- **Pacjent** — w kodzie `Pet`.
- **Opiekun / Klient** — w kodzie `Owner`, ale jako jedyna rola.
- **Termin vs Wizyta** — w kodzie jedno `Visit`.
- **Gatunek** — w kodzie `PetType`; rasy brak.
- **Imię pacjenta** — etykieta, nie identyfikator.

Połowa z 16 pojęć nie ma odpowiednika w kodzie (termin, rasa, masa ciała, status „zmarł”, mikrochip…). Sprawdzone grepem (D1, „Weryfikacja”).

**Najważniejsze rozjazdy model vs kod:**
- **DR-01:** wywiad mówi, że imię nie jest unikalne i ma dawać tylko ostrzeżenie. Kod wymusza unikalność w 3 warstwach, od `521d01d` (2009).
- **DR-02:** `Visit` służy naraz za rezerwację (tylko przyszłe daty) i za zapis kliniczny, więc nagłego przypadku nie da się zapisać.
- **Wniosek z DR-01:** plan L4 utrwala regułę, której domena nie chce (D1 Krok 4, „Weryfikacja” O-01).

**Niezmiennik #1:** „Termin wizyty rezerwuje się na dzień w przyszłości”. Należy do agregatu `Owner`, przez nową metodę `Owner.bookVisit(…, today)` i nazwane błędy domenowe.
- Reguła żyje dziś w 5 miejscach w 4 warstwach, bez agregatu i bazy.
- Dwa obejścia potwierdzone testem na H2: pusta data oraz edycja właściciela przez `pets[0].visits[0].date`.
- Jedynym strażnikiem agregat staje się dopiero po usunięciu setterów `Visit` (zmiana C) (D2, Kroki 2–5, „Konfrontacja” §2).

**Anti-Corruption Layer:**
- **Co przecieka:** kontrakt błędów silnika bazy (format komunikatu sterownika i nazwa obiektu DDL) przez `DataIntegrityViolationException` do kontrolera webowego.
- **Przez ile warstw:** 3 — web (`PetController`), DDL (3 dialekty), testy (2 klasy).
- **Dlaczego to rozjazd z dokumentem:** `README.md:68` obiecuje wymianę bazy samym profilem, a na MySQL ta obietnica już dziś nie działa.
- **Projekt:**
  - port `OwnerStore` i adapter `JpaOwnerStore`;
  - rozpoznanie przez `getKind()`/`getConstraintName()` Hibernate'a w jednym value objekcie `StoreConstraint`;
  - kryterium: grep zwraca tylko `owner/store/`, z jawnym wyjątkiem dla `vet/VetRepository.java` (D3, Kroki 1–6, korekta K-1).

## 6. Decyzje, które należą do mnie

Artefakty zapisują decyzje, ale tylko część z nich wskazuje autora. Poniżej przy każdej decyzji podaję, skąd wiadomo, kto ją podjął.

- **Mapa:** AI zestawiło sygnały z gita, jdeps i JaCoCo. Ja ustaliłem zakres źródeł („tylko historia gita”, bez PR-ów i issue) i zdecydowałem, że tożsamości `king-407` i „shivam tiwari” zostają rozdzielone mimo poszlak (MAP §7; autorstwo wg notatek z sesji mapy).
- **Plan L4:** plan-review zaproponował dwie opcje dla fazy „wszystkie trafienia” i **zarekomendował** Fix A, czyli wydzielenie jej jako osobnej zmiany. W triage przyjąłem Fix A (P4 plan-review F1). Również moja decyzja: implementacja planu nie jest wymagana w tym ćwiczeniu.
- **L5, wybór #1:** to, że #1 w D2 i D3 się nie zmienia, było moim **warunkiem z góry** („nie zmieniaj wyboru #1”), a nie wnioskiem z analizy. Uzasadnienie dostarczyła potem analiza AI: unikalność imienia jest bardziej rozsmarowana, ale mniej rdzeniowa, lepiej pilnowana i odrzucana przez domenę (D2 „Konfrontacja” §1).
- **Weryfikacja AI:** to ja zleciłem przeglądy wyników AI:
  - grep dla trzech pojęć oznaczonych jako „BRAK w kodzie”,
  - kontrolę rozjazdów typu „napraw dokument”,
  - porównanie destylacji z researchem L3,
  - konfrontację INV-06 z L3/L4.

  Własnym grepem wychwyciłem też `VetRepository`, pominięty w kryterium ACL. Wyniki zapisało AI: korekta K-01 historii reguły (od `521d01d`, a nie `e0db9b1`) w D1 „Weryfikacja”, korekta K-1 w D3.
- **Otwarte, czeka na mnie lub maintainera:** Q-01 — czy imię ma blokować zapis, czy tylko ostrzegać. Od tej decyzji zależy, czy plan L4 i fazy F2–F4 ACL w ogóle mają sens (D1, D3 A-01).
