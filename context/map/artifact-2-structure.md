# Artefakt 2: Struktura (zależności statyczne jdeps)

Raport roboczy dla agenta.
- **Źródło:** `jdeps 17.0.21.1` na `target/classes` i `target/test-classes`, z 2026-11-20. Dowody są w `context/map/evidence/jdeps/`.
- **Ścieżki Java:** względne do `src/main/java/org/springframework/samples/petclinic/` (testy: `src/test/java/...`).
- **Odwołania do historii zmian:** `artifact-1-territory.md` = **T1**, np. „T1 a)”.

Skróty plików z dowodami:
- `pkg` = `package/classes.dot`,
- `cf` = `class-full/classes.dot` (klasy razem z zależnościami wewnątrz pakietu),
- `tf` = `test-full/test-classes.dot`,
- `unf` = `package-unfiltered.txt`,
- `cm` = `coupling-metrics.md`,
- `U<n>` = pozycja w `unknowns.md`.

## 1. Najważniejsze obserwacje

1. **Agregat `Owner` to wąskie gardło trzech funkcji z T1.** Wszystkie trzy kontrolery (`Owner`, `Pet`, `Visit`) zależą od `Owner` i `OwnerRepository`. Nie ma `PetRepository` ani `VisitRepository`: zwierzęta i wizyty zapisuje `owners.saveAndFlush(owner)` przez kaskadę.
   - Dowód: `cf` i `cm` (`Owner` Ca 4, `OwnerRepository` Ca 3).
   - T1: właściciele, zwierzęta i wizyty to 14 z 28 commitów.
2. **Struktura typów jest czysta: brak cykli, `owner` ↮ `vet`, wszystko prowadzi do `model`.** Ryzyko zmiany nie leży więc w grafie typów, tylko w powiązaniach przez napisy, SQL i konfigurację, których jdeps nie widzi.
   - Dowód: `find-cycles.mjs` znajduje 0 cykli w `pkg`, `cf` i `tf`.
   - T1: jedyna regresja w oknie (`88e37c1`) pochodzi z obszaru niewidocznego dla jdeps (U19, U23).
3. **Współzmiany z T1 e) w większości nie mają krawędzi w grafie.**
   - Owner+Vet (`500158f`) to kopia paginacji.
   - Trzy kontrolery (`c7ee170`) to wspólny wzorzec bindera.
   - Pets+system (`51045d1`) to zbiorczy commit testów.
   - Testy integracyjne + korzeń (`9a5d50c`) to upgrade Bootu.
   - Z 3 commitów pary właściciele–zwierzęta przez krawędź przechodzi tylko `fd4361b`.
4. **Wysoki fan-in oznacza tu klasy, które się nie zmieniają, a aktywność jest w adapterach.**
   - `PetType`: Ca 5, 0 commitów. Repozytoria: Ca 1–3, 0 zmian funkcjonalnych.
   - `OwnerController`: Ce 2, 4 commity (TOP 1 w T1 b)). `VetController`: Ce 3, 3 commity.
   - Metryki sprzężenia i T1 wskazują więc różne miejsca.
5. **Reguła unikalności imienia zwierzęcia jest w kontrolerze i w napisie.** `PetController.isDuplicatePetNameViolation` dopasowuje `"unique_owner_pet_name"` z trzech `schema.sql` (U24).
   - Dowód: `unf` (`PetController -> org.springframework.dao`), `git show --stat e0db9b1` (zmienione tylko `PetController` i schematy).
   - **Korekta do T1:** `e0db9b1` nie zmienił `PetValidator` ani `Pet.java`, choć T1 e) i „Obserwacje” piszą o walidatorze.

## 2. Punkty wejścia

| Wejście | Endpointy | Ce (`cm`) | Charakter | T1 |
|---------|-----------|:-:|-----------|----|
| `owner/OwnerController` (188 l.) | `/owners/new`, `/owners/find`, `/owners`, `/owners/{id}`, `/owners/{id}/edit` | 2 | **Cienki w grafie, ale z logiką brzegową:** clamp i redirect paginacji, `strip()` nazwiska, binder `setDisallowedFields`. | 4 commity, 5 poprawek po treści (T1 d)) |
| `owner/PetController` (207 l.) | `/owners/{id}/pets/new`, `/owners/{id}/pets/{petId}/edit` | **6** | **Tu zaczyna się logika domenowa:** sprawdzenie duplikatu przed zapisem, obsługa `DataIntegrityViolationException` po napisie, `@InitBinder` z `new PetValidator()`. | 2 commity, w tym jedyny duży feature `e0db9b1` |
| `owner/VisitController` (114 l.) | `/owners/{id}/pets/{petId}/visits/new` | 4 | Średni. `@ModelAttribute` ładuje cały `Owner`, ustawia `minVisitDate` (walidacja daty z `753d35c`). | 2 commity |
| `vet/VetController` (81 l.) | `/vets.html` (HTML, paginacja), `/vets` (`@ResponseBody` JSON/XML) | 3 | Cienki, ale z kopią paginacji z `OwnerController`. | 3 commity, 2 to lustrzane poprawki paginacji |
| `system/WelcomeController`, `system/CrashController` | `/`, `/oups` | 0 | Cienkie. | – |
| Wejścia spoza kontrolerów | `PetTypeFormatter` (konwersja każdego pola `PetType`), `LocaleChangeInterceptor` (`?lang=` na każdym żądaniu), `@Cacheable` na `VetRepository`, inicjalizacja SQL przy starcie | – | Wywoływane przez framework, a nie z kodu (U1–U4, U18–U19). | – |

## 3. Kontrakty między pakietami

Przez granice pakietów (w kodzie main) przechodzą **tylko trzy klasy z `model`**. Encje, repozytoria i formattery są używane wyłącznie we własnym pakiecie. Wyjątki to hint `Vet` (szum, sekcja 8) i testy.

| Kontrakt | Kto zależy (`cf`) | Druga, niewidoczna połowa | T1 |
|----------|-------------------|---------------------------|----|
| `model/BaseEntity` (`id`, `isNew()`) | `NamedEntity`, `Person`, `Visit` → pośrednio wszystkie encje | `isNew()` w `Owner.addPet`/`getPet`, `PetController:111`, `PetValidator:51` i w szablonach `${x['new']}` (U14). ID `IDENTITY` w trzech dialektach. | Błąd `676db04` był w warunku z `isNew()`. |
| `model/NamedEntity` (`name`, `@NotBlank`, bez `@Size`) | `Pet`, `PetType`, `Specialty`, `Vet` (`Comparator`) | `name` to klucz unikalności zwierzęcia i parsowania `PetType`. **Kolumna ma różną długość w każdej tabeli:** `pets` 30, `types` i `specialties` 80. | Limit imienia zwierzęcia trafił do `PetValidator` (`676db04`), bo klasa bazowa nie może go mieć. |
| `model/Person` (`firstName`, `lastName`, `@Size(30)`) | `Owner`, `Vet` (+ hint) | Kolumny w tabelach `owners` i `vets` w trzech schematach. `findByLastNameStartingWith` (U7). `VARCHAR_IGNORECASE` tylko w H2. | `3c06fbf` zmienił walidację bez zmian w `Owner` i `Vet`: dziedziczenie wchłonęło zmianę, ale nie tabele. |
| Kontrakty wewnątrz pakietów | `OwnerRepository` ← 3 kontrolery; `PetTypeRepository` ← `PetController`, `PetTypeFormatter`; `VetRepository` ← `VetController` | `JpaRepository` w `owner` i `Repository` z `@Cacheable`/`@Transactional` w `vet`: dwa style. | `OwnerRepository` zmieniał tylko upgrade `37d5315`. |
| Encje między pakietami (tylko testy) | `tf`: `ClinicServiceTests` (`owner` + `vet`), `PetClinicConcurrencyTests` (`Owner`, `OwnerRepository`, `Pet`), testy integracyjne (`VetRepository`) | Encje i repozytoria są `public` tylko dla testów. Kontrolery są pakietowo-prywatne. | – |

## 4. Cykle

Skrypt: `find-cycles.mjs` (algorytm Tarjana, najkrótsza pętla przez BFS, opcja `--merge-nested`). Sprawdzony na sztucznym grafie z podstawionymi cyklami.

| Poziom | Plik | Wynik |
|--------|------|-------|
| Pakiety | `pkg` | 0 składowych (4 węzły, 4 krawędzie) |
| Klasy main | `cf` | 0 (20 węzłów, 40 krawędzi, także po złączeniu klas zagnieżdżonych) |
| Klasy testów | `tf` | 0 (33 węzły, 57 krawędzi) |

- **Cykle z relacji encji: 0.** Wszystkie relacje są jednokierunkowe: `Owner→Pet` (`@OneToMany @JoinColumn`), `Pet→Visit`, `Pet→PetType` (`@ManyToOne`), `Vet→Specialty` (`@ManyToMany`). Nie ma żadnego `mappedBy`, a `Pet` nie zna `Owner`.
- **Cykle warstw i pakietów: 0.** Kierunek jest zawsze kontroler → repozytorium → encja → `model`.
- **Pętle poza jdeps (unknown):**
  - nawigacja `redirect:/owners/{ownerId}` z `PetController` i `VisitController` do `OwnerController` (U12),
  - kierunek klucza obcego w bazie (`pets.owner_id`) odwrotny do kolekcji w Javie.
- **Ryzyko na przyszłość:** reguła domenowa wymagająca kontekstu właściciela w `Pet` (jak unikalność w `e0db9b1`) skłania do dodania `@ManyToOne Owner`, czyli pierwszego cyklu JPA.

## 5. Granice pakietów i warstw

| Granica | Wynik | Dowód |
|---------|-------|-------|
| `model` nie zależy od aplikacji | ✅ | `cf`: tylko `NamedEntity`/`Person → BaseEntity`; `unf`: tylko JPA i walidacja |
| `owner`, `vet` → `model` | ✅ (wyłącznie dziedziczenie) | `pkg` |
| `owner` ↮ `vet` | ✅ | `pkg`, `cf`. Duplikacja paginacji bez zależności (T1 e)) |
| `system` ↛ funkcje | ✅ w typach, ❌ w napisach | brak w `pkg`/`cf`; cache `"vets"` (U2), `minVisitDate` w `inputField.html` (U15), i18n (U17) |
| Korzeń | `PetClinicRuntimeHints → vet.Vet, model.*`; `PetClinicApplication` bez krawędzi (`@ImportRuntimeHints` to wartość adnotacji) | `cf` |
| Encje i repozytoria ↛ kontrolery, formattery, walidatory | ✅ | `cf`: z encji wychodzą krawędzie tylko do encji i `model`, z repozytoriów tylko do własnej encji |

**Założenia, które nie pasują do kodu:**
- **Brak warstwy serwisowej.** Kontrolery wołają repozytoria i encje bezpośrednio. Pakiet testowy `service/` (`ClinicServiceTests`) to pozostałość po dawnej warstwie.
- **Brak repozytoriów dla zwierząt i wizyt.** Trzy funkcje z T1 to w kodzie jedna ścieżka zapisu przez `Owner`.

**Zaskakujące zależności:**
- `Owner → Visit` przez `Owner.addVisit(petId, visit)`: skrót przez agregat z pominięciem `Pet`.
- `VetRepository` ma `@Cacheable` i `@Transactional` na interfejsie repozytorium.
- `PetController` jest powiązany ze schematem bazy napisem (U24).

## 6. Metryki (tylko istotne dla ryzyka)

Skrypt: `coupling-metrics.mjs`, pełna tabela w `cm`. Liczone są tylko klasy aplikacji, I = Ce/(Ca+Ce). Wartości w nawiasach są po odjęciu szumu z runtime hints (sekcja 8).

**`model`: Ca 7 (6), Ce 0, I 0.00 · 3 commity**
- **Evidence:** od pakietu zależy 7 klas z zewnątrz, a on sam od żadnej.
- **Inference:** stabilny kontrakt, ale konkretny (`@MappedSuperclass` z polami).
- **Caution:** zmiana w `Person` dotyka `Owner` i `Vet` oraz tabel `owners` i `vets` w trzech schematach.
- **Unknowns:** strategia snake_case (U20), szablony (U14).

**`owner`: Ca 0, Ce 3, I 1.00 · 14 z 28 commitów**
- **Evidence:** liść na poziomie pakietów.
- **Inference:** I = 1.00 jest właściwe dla często zmienianego kodu, ale ukrywa środek grafu wewnątrz pakietu.
- **Caution:** metryka pakietu nie oznacza, że zmiana jest bezpieczna.
- **Unknowns:** szablony `owners/` i `pets/`, przekierowania (U11–U12).

**`vet`: Ca 1 (0), Ce 2, I 0.67 (1.00) · 3 commity**
- **Evidence:** jedyny klient pakietu to hint.
- **Inference:** po odjęciu szumu to liść jak `owner`.
- **Caution:** zmiana `Vet` może zepsuć tylko build natywny.
- **Unknowns:** cache (U2, U9, U36), XML (U32).

**`system`: Ca 0, Ce 0, I n/a**
- **Evidence:** brak krawędzi.
- **Inference:** fałszywa izolacja.
- **Caution:** przed zmianą sprawdź nazwy cache, `lang` i fragmenty szablonów.
- **Unknowns:** U2, U3, U15, U16.

**`owner.Owner`: Ca 4, Ce 3, I 0.43 · 3 commity (T1 b) #2)**
- **Evidence:** zależą od niej trzy kontrolery i repozytorium. Odwołuje się do niej 6 klas testowych.
- **Inference:** środek grafu.
- **Caution:** przy zmianie `addPet`, `addVisit` albo `getPet` uruchom testy wszystkich trzech kontrolerów. W oknie zmiany `Owner` (`3c7ab98`, `676db04`, `fd4361b`) nie dotknęły kontrolerów, bo kontrakt się nie zmienił.
- **Unknowns:** kaskada, EAGER, `open-in-view=false` (U10).

**`owner.Pet`: Ca 4, Ce 3, I 0.43**
- **Evidence:** zależą od niej `Owner`, `PetController`, `VisitController` i `PetValidator`.
- **Inference:** środek grafu.
- **Caution:** zmiana walidacji wymaga sprawdzenia `PetValidator`, indeksu w trzech schematach i napisu w `PetController`.
- **Unknowns:** U23, U24.

**`owner.PetType`: Ca 5, Ce 1, I 0.17 · 0 commitów**
- **Inference:** stabilny słownik.
- **Caution:** `PetTypeFormatter` paruje typ po nazwie, a wartości `<select>` pochodzą z `data.sql`.
- **Unknowns:** U4, U25.

**`owner.OwnerRepository`: Ca 3, Ce 1, I 0.25**
- **Inference:** stabilny kontrakt, interfejs, jeden dla trzech funkcji.
- **Caution:** jest mockowany w trzech `@WebMvcTest`, a zapytania na prawdziwej bazie są testowane tylko na H2.
- **Unknowns:** U7.

**`owner.PetController`: Ca 0, Ce 6, I 1.00**
- **Inference:** gruby adapter, najwyższy Ce w aplikacji.
- **Caution:** zmiana dowolnej z 6 zależności go dotyka. Test wymaga 2 mocków i `includeFilters`.
- **Unknowns:** U5, U24.

**`owner.OwnerController`: Ca 0, Ce 2, I 1.00 · 4 commity (T1 b) #1)**
- **Inference:** cienki adapter, a ryzyko leży w logice wejścia, nie w sprzężeniu.
- **Caution:** paginacja ma bliźniaka w `VetController`, a binder dwa bliźniaki w `PetController` i `VisitController`.

## 7. Ryzyka testowe

Rodzaje testów dziś:
- jednostkowe (Mockito i czyste),
- `@WebMvcTest` × 5,
- `@DataJpaTest` × 1 (`ClinicServiceTests`, H2, `Replace.NONE`),
- `@SpringBootTest` na H2 × 3,
- MySQL przez Testcontainers (`disabledWithoutDocker = true`),
- Postgres przez Docker Compose.

| # | Ryzyko | Dowód | Właściwy poziom |
|---|--------|-------|-----------------|
| 1 | Duplikat imienia rozpoznawany po napisie, a test podaje wymyślony komunikat (`PetControllerTests:168`, `:259`) | `unf`; `ClinicServiceTests` i `PetClinicConcurrencyTests` tylko na H2 | prawdziwa baza (MySQL, Postgres) |
| 2 | Idempotentność schematu przy `sql.init.mode=always` (regresja `88e37c1`) | testy MySQL i Postgres sprawdzają tylko `findAll` i `/owners/1` | prawdziwa baza, dwa starty |
| 3 | Zapis zwierzęcia i wizyty przez kaskadę `Owner` jest zmockowany w `@WebMvcTest` | `tf`: `VisitControllerTests → Owner, OwnerRepository, Pet` | jednostkowy `Owner.addPet`/`addVisit` + `@DataJpaTest` |
| 4 | Paginacja i wyszukiwanie: dobrze w `@WebMvcTest`, na bazie tylko H2 | `OwnerControllerTests:184`, `VetControllerTests:97` | `@WebMvcTest` wystarcza; `@DataJpaTest` dla zapytań |
| 5 | Limity długości bez testu zgodności z kolumną | `model.ValidatorTests → Person`; brak testu encji `Visit` | jednostkowy + `@DataJpaTest` z danymi o maksymalnej długości |
| 6 | Cache `"vets"` testowany tylko komentarzem `// served from cache` | `PetClinicIntegrationTests → VetRepository` | `@SpringBootTest` z asercją `CacheManager` |
| 7 | XML z `/vets` nie ma testu | brak krawędzi z testów do `Vets` | `@WebMvcTest` z `accept(APPLICATION_XML)` |
| 8 | Testy MySQL znikają po cichu bez Dockera | `MySqlIntegrationTests:43` | proces: zmiana schematu wymaga przebiegu z Dockerem |

**Klasy bez testów.**
- Pozorne: wszystkie kontrolery (`@WebMvcTest(X.class)` nie jest krawędzią) i `NamedEntity` (testowana przez podklasy).
- Realne:
  - `vet/Vets` (XML),
  - `system/CacheConfiguration`,
  - `system/WebConfiguration` (`?lang=`),
  - `PetClinicRuntimeHints` (brak buildu natywnego w CI, kontrolery mają `@DisabledInNativeImage`/`@DisabledInAotMode`).
- Częściowe: `owner/Visit` (brak testu walidacji encji) i wszystkie repozytoria (tylko H2).

**Podejrzane klasy:**
- `PetController` (Ce 6),
- `VisitController` (Ce 4, ładuje cały agregat),
- `Owner` (środek grafu),
- `VetController` (cache na repozytorium niewidoczny dla mocka),
- test `service/ClinicServiceTests` (zależy od 11 klas, pakiet po nieistniejącej warstwie).

## 8. „Wygląda groźnie, ale nie jest”

| Wynik | Dlaczego to szum |
|-------|------------------|
| `PetClinicRuntimeHints → Vet, Person, BaseEntity`, pakiet `vet` Ca 1, korzeń Ce 3 | Literały klas w `registerType(...)`. To szum dla metryk sprzężenia, ale **nie** dla ryzyka buildu natywnego (U27–U29). |
| `PetClinicApplication`: Ca 0, Ce 0, Ca_test 3 | `@ImportRuntimeHints` to wartość adnotacji. Testy odwołują się do klasy tylko po to, żeby wystartować aplikację. |
| `system/*`: Ca 0, Ce 0, I n/a | Klasy `@Configuration` i kontrolery wiąże z resztą skanowanie komponentów i routing. Zero oznacza „niewidoczne”, a nie „izolowane”. |
| `Ca_test = 0` dla 5 kontrolerów | `@WebMvcTest(X.class)` nie jest krawędzią. Testy istnieją. |
| Adnotacje bibliotek w `unf` (`jakarta.persistence`, `jakarta.validation`, `@DateTimeFormat`, `@Xml*`, `@Cacheable`, `@Transactional`, stereotypy) | Nie wchodzą do Ca i Ce. Nie łamią granic, ale przenoszą decyzje webowe do encji (`@DateTimeFormat`, `@Xml*`). |
| Węzeł `classes` i pętla `classes -> classes` w `package/summary.dot` | Krawędź między całymi archiwami, a nie między kodem aplikacji. |
| Współzmiany T1 e) bez krawędzi: Pets+system (`51045d1`), testy integracyjne + korzeń (`9a5d50c`) | Zbiorczy commit testów i upgrade Bootu. To nie sprzężenie strukturalne. |

**Nie jest szumem:**
- dziedziczenie po klasach z `model`,
- `Vet → NamedEntity` (`Comparator.comparing(NamedEntity::getName)`, czyli kod, a nie adnotacja).

## 9. Unknowns

Pełna lista: `evidence/jdeps/unknowns.md` (U1–U36, ze ścieżką, rodzajem luki i weryfikacją). Najważniejsze:

| Obszar | Unknowns | Najważniejsze |
|--------|----------|---------------|
| Runtime Springa | U1–U6, U10, U36 | **U36 (hipoteza):** na classpath nie ma `caffeine:jcache`, więc `JCacheManagerCustomizer` może się nie wykonywać. Weryfikacja: `GET /actuator/caches`. |
| Spring Data | U7–U9 | Zapytanie z nazwy metody na `lastName`; `@Query` jako tekst; `findAll` i `findAll(Pageable)` w jednym cache bez `@CacheEvict` |
| Szablony | U11–U17 | Nazwy widoków i `redirect:` jako napisy; `inputField.html` czyta `minVisitDate` ustawiany tylko przez `VisitController` (U15); tekst na sztywno w `pets/createOrUpdatePetForm.html` łamie zasadę i18n z `AGENTS.md` (U17) |
| Properties i profile | U18–U22 | `db/${database}/` wybiera skrypty; `sql.init.mode=always` w mysql i postgres (przyczyna `88e37c1`); snake_case z nazw pól |
| SQL | U23–U26 | Długości kolumn ↔ `@Size`; napis `unique_owner_pet_name`; dane startowe (`types`, właściciel `id=1` w testach) |
| Hints, refleksja, walidacja | U27–U32 | **U28:** hint `mysql-default-conf` wskazuje nieistniejący zasób; limit imienia zwierzęcia w `PetValidator`, a nie w `@Size` (U30) |
| Frontend | U33–U35 | CSS z SCSS tylko przez `-P css`, a wynik jest commitowany; **U34:** `build.gradle` nie ma odpowiednika profilu `css` |

## 10. Pliki, skrypty i komendy

**SVG nie ma.** Graphviz nie jest zainstalowany, więc grafy są w Mermaid.

Wszystko w `context/map/evidence/jdeps/`:

| Plik | Zawartość |
|------|-----------|
| `README.md` | Środowisko (Temurin 17.0.21.1), wszystkie komendy jdeps (kroki 1–8), tabela pokrycia |
| `graphs.md` | Mermaid: graf pakietów i graf klas „dlaczego zmiana w `Owner` dotyka trzech funkcji” |
| `package/`, `class/`, `test/` | DOT z poleceń bazowych (`-verbose:package`, `-verbose:class`) |
| `class-full/`, `test-full/` | DOT z `-verbose`, czyli razem z zależnościami wewnątrz pakietu. **Używaj tych plików do analizy klas.** |
| `package-unfiltered.txt` | Pakiety razem z zależnościami od bibliotek |
| `find-cycles.mjs` | Silnie spójne składowe i najmniejsza pętla |
| `coupling-metrics.mjs`, `coupling-metrics.md` | Ca, Ce, I i Ca_test dla pakietów i klas |
| `dot-to-mermaid.mjs` | DOT → Mermaid (filtr pakietu, skracanie nazw, `--only`) |
| `unknowns.md` | U1–U36 |

Odtworzenie (z katalogu repo, JDK 17 w `PATH`):

```sh
./mvnw -B -q -Dcheckstyle.skip compile test-compile   # nohttp zgłasza nieśledzone pliki .claude/
./mvnw -q dependency:build-classpath -Dmdep.outputFile=target/cp.txt
# komendy jdeps: evidence/jdeps/README.md
cd context/map/evidence/jdeps
node find-cycles.mjs class-full/classes.dot --strip-prefix org.springframework.samples.petclinic. --merge-nested
node coupling-metrics.mjs class-full/classes.dot --test test-full/test-classes.dot \
  --classes-dir ../../../../target/classes --strip-prefix org.springframework.samples.petclinic. > coupling-metrics.md
node dot-to-mermaid.mjs package/classes.dot --extra system
```

**Pozostałości do usunięcia:**
- `context/map/jdeps/`: pierwsza wersja grafów, zastąpiona przez `evidence/jdeps/`,
- `~/.jdks/_dl`: zip JDK.
