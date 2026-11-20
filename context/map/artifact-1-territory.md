# Artefakt 1: Terytorium (historia zmian i aktywne obszary)

Raport roboczy. Źródło: `git log` z ostatnich 12 miesięcy, od 2025-11-20 do 2026-11-20.
- **Stan repo:** `527d61b` (rodzic commita `28c6411`, który dodał ten plik).
- **Obszary:** nazwy z tego pliku przechodzą na wspólną listę według tabeli w `areas.md` (A1–A8, P1, X1–X4).

## Zakres i metoda

- **Okno:** pełne 12 miesięcy, bo historia repo sięga 2013-01-09 (łącznie 1048 commitów). W oknie jest 48 commitów: 1 merge i 47 zwykłych.
- **Jednostka:** liczba commitów, które dotknęły obszaru lub pliku. Nie liczba linii.
- **Pominięte commity:**
  - merge `ab1d536` (jego treść jest w `430b5ff` i `f5b8a89`),
  - mechaniczne przeglądy: `44d5f21` (usunięcie adnotacji jspecify z 16 plików) i `37c7f98` (zmiana nazw metod testowych w 16 plikach plus podbicie zależności),
  - `3e1ce23` („Polish”) nie jest wykluczony jawnie, ale dotyka tylko `pom.xml`, więc odpada razem z plikami buildu. T3 wyklucza go jawnie i wynik jest ten sam.
- **Boty:** w oknie nie ma commitów botów (dependabot, renovate itp.). Podbicia wersji robili ludzie, a te commity w większości dotykają tylko plików build, odfiltrowanych niżej. Duże commity funkcjonalne zostały, na przykład `e0db9b1` (7 plików, +266 linii).
- **Odfiltrowany szum:**
  - pliki buildu i wrappery: `pom.xml`, `build.gradle`, `gradle/`, `.mvn/`, `gradlew*`, `mvnw*`,
  - konfiguracja i infrastruktura: `application*.properties`, `native-image.properties`, `docker-compose.yml`, `k8s/`, `.github/`, `.sdkmanrc`,
  - pliki generowane: `petclinic.css`,
  - grafiki i pliki binarne,
  - dokumentacja `*.md` i `*.txt`. `README.md` miał 9 commitów, ale to nie jest obszar produktu.
- **Zmiany nazw i przenosiny:** `git log -M --diff-filter=R` nie znalazł w oknie żadnej. Nie było więc ścieżek do łączenia.
- **Po filtrach:** 28 commitów. Pierwsza wersja raportu podawała 29, bo liczyła `828940e`, którego jedyny niefiltrowany plik to `.sdkmanrc`, a ten należy do szumu.

## Udział agentów AI

Commity agenta wykrywam tylko po trailerze `Co-Authored-By: Claude …`. Commitów AI bez takiego oznaczenia nie da się odróżnić od ludzkich.

- **W całym oknie:** 2 z 48 commitów (4%):
  - `a2c2ef9` (Claude Opus 4.7): rejestracja native resource hints dla skryptów `db/{h2,mysql,postgres}/`,
  - `527d61b` (Claude Opus 5.5): `AGENTS.md`, odfiltrowany jako dokumentacja.
- **Po filtrach:** 1 z 28 commitów (4%). Jedyny obszar z aktywnością AI to korzeń aplikacji (`PetClinicRuntimeHints`).

## a) TOP 10 obszarów

Pakiet `owner/` łączy trzy funkcje: właścicieli, zwierzęta i wizyty. Na poziomie pakietu dałby ogólny wynik (11 commitów), więc rozbiłem go na funkcje. Kod main i testy tej samej funkcji liczę razem.

| # | Obszar | Commity (AI) | Funkcja produktu |
|---|--------|--------------|------------------|
| 1 | Właściciele: `owner/Owner*`, `OwnerController*`, `templates/owners/` | 8 (0) | Wyszukiwanie właścicieli z paginacją, rejestracja i edycja ich danych. |
| 2 | Zwierzęta: `owner/Pet*`, `PetValidator*`, `PetType*`, `templates/pets/createOrUpdatePetForm.html` | 7 (0) | Dodawanie i edycja zwierząt właściciela z walidacją. Unikalność imienia u jednego właściciela pilnuje `PetController` i indeks w bazie, a nie `PetValidator` (patrz T2 §1.5). |
| 3 | Testy integracyjne w korzeniu: `PetClinicIntegrationTests`, `PetClinicConcurrencyTests`, `MySqlIntegrationTests`, `MysqlTestApplication`, `PostgresIntegrationTests` | 6 (0) | Uruchamianie całej aplikacji na H2, MySQL i PostgreSQL. Zmiany szły głównie za upgrade'ami Bootu i obrazów baz. |
| 4 | Skrypty baz: `src/main/resources/db/{h2,mysql,postgres}/` | 4 (0) | Schemat i dane startowe dla trzech baz. |
| 5 | Weterynarze: `vet/`, `templates/vets/` | 3 (0) | Lista weterynarzy ze specjalizacjami, z paginacją i API JSON/XML. |
| 6 | Wizyty: `owner/Visit*`, `templates/pets/createOrUpdateVisitForm.html` | 3 (0) | Rejestrowanie wizyt zwierzęcia z walidacją daty i opisu. |
| 7 | Tłumaczenia: `src/main/resources/messages/` | 3 (0) | Teksty interfejsu w 10 językach, ostatnio dodane hindi i japoński. |
| 8 | System: `system/`, `templates/fragments/` | 3 (0) | Strona powitalna, obsługa błędów, cache, wspólne fragmenty formularzy i test spójności i18n. |
| 9 | Model bazowy: `model/` | 3 (0) | Wspólne encje `BaseEntity`, `NamedEntity` i `Person` z walidacją imienia i nazwiska. |
| 10 | Korzeń aplikacji: `PetClinicApplication`, `PetClinicRuntimeHints` | 2 (1) | Start aplikacji i podpowiedzi dla obrazu natywnego (GraalVM/AOT). Remis z testami serwisowymi `service/` (2). |

*Korekta:* `PetClinicConcurrencyTests` (`e0db9b1`) był wcześniej błędnie liczony do korzenia aplikacji. To test integracyjny, więc tabele a), c) i d) są już poprawione.

*Uzupełnienie ścieżek:* szablony `templates/pets/` i `templates/vets/` dopisano do obszarów 2, 5 i 6. W oknie nie miały commitów (jedyny commit w `templates/` to `753d35c` w `fragments/`), więc liczby się nie zmieniają.

## b) TOP 10 plików

| # | Plik (pod `org/springframework/samples/petclinic/`) | Commity | Funkcja produktu |
|---|------|---------|------------------|
| 1 | `owner/OwnerController.java` | 4 | Wyszukiwanie i paginacja właścicieli, formularze właściciela i bezpieczne wiązanie pól. |
| 2 | `owner/Owner.java` | 3 | Encja właściciela: limity długości pól i powiązanie ze zwierzętami. |
| 3 | `vet/VetController.java` | 3 | Lista weterynarzy z paginacją i zabezpieczeniem numeru strony. |
| 4 | `owner/OwnerControllerTests.java` (test) | 3 | Testy wyszukiwania, paginacji i walidacji właściciela. |
| 5 | `owner/PetControllerTests.java` (test) | 3 | Testy dodawania i edycji zwierzęcia, w tym zdublowanego imienia. |
| 6 | `PetClinicIntegrationTests.java` (test) | 3 | Pełny start aplikacji na H2. |
| 7 | `MySqlIntegrationTests.java` (test) | 3 | Pełny start na MySQL przez Testcontainers. |
| 8 | `MysqlTestApplication.java` (test) | 3 | Lokalne uruchamianie aplikacji na MySQL. |
| 9–10 | Remis po 2 commity: `owner/PetController.java`, `owner/Visit.java`, `owner/VisitController.java`, `owner/VisitControllerTests.java`, `owner/PetValidatorTests.java`, `PetClinicRuntimeHints.java`, `db/postgres/schema.sql`, `model/Person.java`, `service/ClinicServiceTests.java` (test) | 2 | Zwierzęta, wizyty, hinty natywne, schemat PostgreSQL i walidacja `Person`. |

## Obserwacje

- **Słaby sygnał statystyczny.** Po filtrach zostaje 28 commitów, a lider ma 8. Kolejność od miejsca 5 w dół to w praktyce remisy.
- **Rdzeń aktywności hands-on to `owner/`:** właściciele, zwierzęta i wizyty łącznie, 14 z 28 commitów.
- **Dominujący temat w 2026:** utwardzanie wejścia od zewnętrznych kontrybutorów:
  - limity długości zgodne z kolumnami (`3c7ab98`, `676db04`, `f3c7483`, `3c06fbf`),
  - granice paginacji i przepełnienia liczb (`500158f`, `0d064b0`, `b33136f`),
  - unikalne imię zwierzęcia (`e0db9b1`, `88e37c1`).
- **Prace utrzymaniowe maintainerów** (upgrade'y Bootu 4.0 i 4.1, Java 17, obrazy baz) skupiają się w plikach buildu i w testach integracyjnych. Dlatego te testy są na miejscu 3, choć nie są funkcją produktu.
- **Commit `e0db9b1` (unikalne imię zwierzęcia)** jest jedynym dużym feature'em w oknie. Przecina zwierzęta, schemat bazy, testy serwisowe i testy integracyjne (nowy `PetClinicConcurrencyTests`).

## c) Nacisk pracy w czasie (kwartały)

Kwartały są kalendarzowe, a commit przypisuję do kwartału po dacie autora. 12 miesięcy wystarcza na podział kwartalny, choć skrajne kwartały są niepełne:

- 2025Q4 obejmuje praktycznie tylko listopad i grudzień. Jeden commit (`8f08b38`) ma datę autora 2025-10-29, ale do repo trafił w oknie.
- 2026Q4 obejmuje 1.10–20.11.

Filtry są te same co wyżej. Liczby to commity, które dotknęły obszaru.

| Obszar | 2025Q4 | 2026Q1 | 2026Q2 | 2026Q3 | 2026Q4* | Trend |
|--------|:-----:|:-----:|:-----:|:-----:|:------:|-------|
| Właściciele | 2 | 0 | 1 | **5** | 0 | **rosnący** |
| Zwierzęta | 1 | 0 | **3** | **3** | 0 | **rosnący** |
| Wizyty | 0 | 0 | 2 | 1 | 0 | **rosnący** (słaby sygnał) |
| Weterynarze `vet/` | 0 | 0 | 1 | 2 | 0 | **rosnący** (słaby sygnał) |
| Tłumaczenia `messages/` | 0 | 0 | 1 | 2 | 0 | **rosnący** (słaby sygnał) |
| Skrypty baz `db/` | 2 | 0 | 0 | 2 | 0 | **sezonowy** |
| Testy integracyjne | 1 | **3** | 1 | 1 | 0 | **sezonowy** |
| Korzeń aplikacji (RuntimeHints) | 0 | 0 | 2 | 0 | 0 | **wygasający** (jedna fala w 2026Q2) |
| Testy serwisowe `service/` | 1 | 0 | 0 | 1 | 0 | **sezonowy** |
| System `system/` + fragmenty | 1 | 0 | 1 | 1 | 0 | **stały** |
| Model bazowy `model/` | 1 | 0 | 2 | 0 | 0 | **wygasający** |
| *Commity po filtrach* | 4 | 3 | 9 | 12 | 0 | |
| *Wszystkie commity (bez merge)* | 14 | 8 | 11 | 13 | 1 | |

\* 2026Q4 jest niepełny. Jedyny commit to `527d61b` (`AGENTS.md`), odfiltrowany jako dokumentacja. Ostatnia zmiana kodu produktu jest z 2026-09-29, więc od ok. 7 tygodni projekt nie ma aktywności produktowej. Zera w 2026Q4 nie świadczą więc o wygasaniu pojedynczych obszarów.

### Definicje etykiet

- **Stały:** obszar obecny w większości kwartałów na podobnym, niskim poziomie.
- **Rosnący:** obszar, którego udział wyraźnie rośnie w 2026Q2–Q3.
- **Wygasający:** obszar aktywny wcześniej, bez zmian w ostatnim pełnym kwartale.
- **Sezonowy:** obszar, w którym zmiany przychodzą falami związanymi z konkretnym wydarzeniem, np. upgrade'em frameworka albo pojedynczym featurem, a nie ciągłą pracą.

### Jak przesuwał się nacisk

1. **2025Q4: platforma, prowadzą maintainerzy** (14 commitów, z czego tylko 4 po filtrach).
   - Commity: upgrade do Spring Boot 4.0 (`37d5315`), wsparcie Java 17 (`828940e`), usunięcie jspecify (`44d5f21`), strategia nazw snake_case (`fd4361b`), usunięcie odwołań do HSQLDB (`2beb238`), poprawka użytkownika MySQL (`8f08b38`).
   - W tym kwartale nie ma nowych funkcji. Kod produktu zmieniały migracja, porządki i poprawka skryptu MySQL.
2. **2026Q1: utrzymanie** (8 commitów, 3 po filtrach).
   - Commity: aktualizacje zależności i obrazów baz, `fetch size` w Hibernate, poprawka `main` dla docker compose.
   - Jedyny obszar kodu z ruchem to testy integracyjne. Na 3 commity tylko `edf4db2` (obrazy baz) jest upgrade'em. `e316074` (fetch size) i `a4fcf04` (`main` dla docker compose) to zmiany konfiguracji.
3. **2026Q2: przejście w stronę walidacji** (9 commitów po filtrach).
   - Maintainer zawęża dozwolone pola w binderach (`c7ee170`, temat bezpieczeństwa).
   - Pojawiają się pierwsze walidacje od społeczności: `Person` (`3c06fbf`, `a6efbed`) i data wizyty (`753d35c`).
   - Równolegle trwa upgrade do Boot 4.1 (`9a5d50c`) i rozszerzane są hinty natywne (`a2c2ef9`, jedyny commit AI w kodzie).
4. **2026Q3: szczyt pracy funkcjonalnej i utwardzania wejścia** (12 commitów po filtrach, prawie wyłącznie od zewnętrznych kontrybutorów).
   - Unikalne imię zwierzęcia z poprawką constraintu w PostgreSQL (`e0db9b1`, `88e37c1`).
   - Utwardzenie danych wejściowych: limity długości pól właściciela, zwierzęcia i wizyty (`3c7ab98`, `676db04`, `f3c7483`), normalizacja wyszukiwania (`bb37aad`), granice paginacji i przepełnienia liczb (`500158f`, `0d064b0`, `b33136f`).
   - Nowe języki: hindi i japoński.
   - Owners, pets, vet i i18n osiągają tu maksimum.
5. **2026Q4: cisza.** Do 20.11 nie ma zmian w kodzie produktu. `git log` pokazuje tylko przyjęte zmiany, więc nie mówi, czy w tym czasie były zgłoszenia, których nie przyjęto.

**Wniosek:** w ciągu roku nacisk przesunął się z platformy (migracje frameworka, robione przez maintainerów) na funkcje domenowe w `owner/`, czyli walidację i odporność formularzy, wnoszone przez społeczność. W obszarach infrastrukturalnych związek z upgrade'ami jest tylko częściowy:
- testy integracyjne: 3 z 6 commitów to upgrade'y (`37d5315` Boot 4.0, `edf4db2` obrazy baz, `9a5d50c` Boot 4.1),
- hinty natywne: 1 z 2 (`9a5d50c`),
- `db/`: żaden. Zmiany tam to feature `e0db9b1` i jego poprawka, porządki HSQLDB i skrypt MySQL.

Hipoteza, bez dowodu w historii: następne wydanie Bootu znów poruszy testy integracyjne. Liczby są małe (0–5 na komórkę), więc etykiety „rosnący” dla wizyt, `vet/` i i18n opierają się na 1–2 commitach i trzeba je traktować ostrożnie.

## d) Poprawki i reverty w 5 najaktywniejszych obszarach

Pierwsze cztery obszary wynikają wprost z rankingu a). Piąte miejsce dzieli pięć obszarów po 3 commity. Wziąłem `vet/`, bo jako jedyny z nich ma plik w TOP 3 plików (`VetController.java`).

Poprawki liczę na dwa sposoby:
- **po temacie:** commit, którego temat zawiera `fix`, `revert`, `hotfix` albo `bug`,
- **po treści:** commit, który według diffu koryguje dotychczasowe złe zachowanie, nawet jeśli temat tego nie mówi. Przykład: `Prevent HTTP 500…`.

| Obszar | Commity | Poprawki po temacie | Poprawki po treści | Reverty |
|--------|:-------:|:-----------:|:------------:|:-------:|
| Właściciele | 8 | 2 (25%) | 5 (63%) | 0 |
| Zwierzęta | 7 | 1 (14%) | 1 (14%) | 0 |
| Testy integracyjne | 6 | 1 (17%) | 1 (17%) | 0 |
| Skrypty baz `db/` | 4 | 2 (50%) | 2 (50%) | 0 |
| Weterynarze `vet/` | 3 | 0 (0%) | 2 (67%) | 0 |

**Reverty:** w żadnym z tych obszarów nie ma revertów. W całym oknie są dwa i oba dotyczą wyłącznie `pom.xml`, czyli buildu, który odfiltrowałem:
- `c71ccfd` „Revert checkstyle to latest v12”: wycofanie zbyt świeżego podbicia wersji,
- `fc1c749` „Revert removal of --release 17”: przywrócenie flagi kompilatora przy wsparciu Javy 17.

Żaden revert nie cofał zmiany funkcjonalnej.

### Co faktycznie poprawiano (przeczytane tematy i diffy)

**Właściciele: 5 poprawek, 4 z nich dotyczą brzegowych danych wejściowych.**
- `3c7ab98`: `city` lub `address` dłuższe niż kolumna dawały HTTP 500. Dodano `@Size` zgodne ze schematem.
- `bb37aad`: spacje wokół nazwiska psuły wyszukiwanie. Dodano `strip()` i test regresji.
- `0d064b0`: `page ≤ 0` trafiał do `PageRequest.of(page - 1)`. Dodano clamp do 1.
- `500158f`: strona spoza zakresu daje teraz redirect na stronę 1. Ten commit domyka poprzedni: ten sam autor, 5 dni później.
- `676db04`: `Owner.addPet` mógł zdublować zwierzę już przypisane do kolekcji. To jedyny błąd logiki domenowej, a nie walidacji.

Nie liczę jako poprawek:
- `c7ee170` (`*.id` w disallowed fields): prewencyjne utwardzenie bindera przez maintainera, bez zgłoszonego błędu,
- `fd4361b`, `37d5315`: migracje.

**Zwierzęta: 1 poprawka.** To `676db04`, ten sam błąd `addPet` co wyżej, plus limit 30 znaków imienia. Pozostałe commity to nowy feature (`e0db9b1`, unikalne imię u właściciela) i trzy commity dodające same testy (`51045d1`, `b3ee2c5`, `b11afec`).

**Testy integracyjne: 1 poprawka.** To `a4fcf04`: `main()` testowej aplikacji nie wyłączał lifecycle docker compose. Narzędzie deweloperskie, bez wpływu na produkt. Pozostałe commity to upgrade'y i nowy test współbieżności z `e0db9b1`.

**Skrypty baz: 2 poprawki, w tym jedyna prawdziwa regresja w oknie.**
- `88e37c1` naprawia regresję z `e0db9b1`, wprowadzoną 8 dni wcześniej. Profil `postgres` ma `spring.sql.init.mode=always`, więc schemat wykonuje się przy każdym starcie. Temat commita (`relation "unique_owner_pet_name" already exists`, issue #2584) razem z tym ustawieniem wskazuje, że nazwany indeks bez `IF NOT EXISTS` wywracał każdy kolejny start na trwałej bazie. To wniosek z tematu i konfiguracji, nie z odtworzenia błędu. Poprawka uczyniła idempotentnymi wszystkie indeksy.
- `8f08b38`: skrypt zakładania użytkownika MySQL nie działał na MySQL 8+. To dryf środowiska, nie błąd kodu.

**Weterynarze: 2 poprawki.** To lustrzane kopie poprawek paginacji z właścicieli: `b33136f` (clamp) i `500158f` (redirect), od tego samego autora. Trzeci commit (`1312314`) to sprzątanie nieużywanego obiektu.

### Wniosek: ważne czy psujące się?

- **Żaden obszar nie spełnia kryterium „ciągle się psuje”.** Nie ma revertów w kodzie i nie ma poprawek tego samego błędu przez różne osoby. Jest tylko jeden łańcuch „poprawka poprawki” (`0d064b0` → `500158f`), czyli jeden autor iterujący nad tym samym tematem.
- **Właściciele i weterynarze to obszary ważne, z utajonym długiem walidacyjnym, a nie niestabilne.**
  - Wysoki udział poprawek (63–67%) to efekt fali utwardzania z 2026Q3: zewnętrzni kontrybutorzy znajdują stare przypadki brzegowe w danych wejściowych (długość pól, spacje, numer strony).
  - Nie są to regresje po niedawnych zmianach. Poprawiany kod jest starszy niż okno:
    - `PageRequest.of(page - 1…)` od `8ad9c05` (2021-09-13),
    - pola `address`/`city` bez `@Size` i kolumny o stałej długości od `c0847b7` (2020-03-20),
    - `findByLastNameStartingWith` od `1cad412` (2024-11-10),
    - `addPet` z `if (pet.isNew())` od `83ff9a5` (2016-11-10).
  - Fakt: ten sam typ poprawki, czyli limit długości zgodny z kolumną, pojawił się w `Owner`, `Pet`, `Visit` i `Person` (patrz sekcja „Obserwacje”).
  - Interpretacja: brakuje jednego miejsca, które pilnuje zgodności walidacji ze schematem. To raczej luka konwencji niż problem architektury pojedynczego modułu. Reguła o zgodności `@Size` z kolumnami jest już w `AGENTS.md`.
- **Zwierzęta to obszar ważny i zdrowy:** dużo pracy funkcjonalnej i testów, mało poprawek.
- **Skrypty baz to najbardziej ryzykowny obszar w sensie regresji,** choć mało aktywny.
  - Schemat jest powielony w trzech dialektach, a na Postgresie wykonuje się przy każdym starcie.
  - Hipoteza: błąd tego typu omija testy na H2, bo H2 ma osobny plik schematu i działa w pamięci, więc wychodzi dopiero na trwałej bazie. Historia nie pokazuje wprost, jak błąd wykryto.
  - Jedyna regresja w oknie pochodzi właśnie stąd.
- **Testy integracyjne to obszar utrzymaniowy.** Poprawki dotyczą narzędzi, nie produktu.

Zastrzeżenie: próbka jest mała (3–8 commitów na obszar). Pojedynczy commit zmienia udział o 12–33 punkty procentowe.

## e) Sprzężenia: obszary zmieniane w tych samych commitach

Obszary są te same co w a), a kod main i test jednej funkcji liczę jako jeden obszar. Bazą jest 28 commitów po filtrach.

Dodatkowo pominąłem `37d5315` (upgrade do Spring Boot 4.0.0, 4 obszary i 12 plików). To szeroka migracja, a nie powiązana praca. Mechaniczne przeglądy `44d5f21` i `37c7f98` (po 16 plików) były odrzucone już wcześniej.

Zostawiłem `e0db9b1`, choć też dotyka 4 obszarów. To jeden spójny feature w 7 plikach (unikalne imię zwierzęcia), a nie zmiana „po całym repo”. Zostaje 27 commitów.

Procent to udział wspólnych commitów w liczbie commitów **mniej aktywnego** obszaru z pary, liczonej w tej samej bazie 27 commitów. Aktywność obszarów w tej bazie:
- 7: właściciele, zwierzęta,
- 5: testy integracyjne,
- 4: `db`,
- 3: `vet`, wizyty, tłumaczenia, `model`,
- 2: `system`, korzeń aplikacji,
- 1: `service`.

### Pary

| Para | Wspólne commity | % mniej aktywnego | Commity |
|------|:----:|:----:|---------|
| Właściciele + Zwierzęta | **3** | 43% (z 7) | `676db04`, `c7ee170`, `fd4361b` |
| Właściciele + `vet` | 1 | 33% (z 3) | `500158f` |
| Właściciele + Wizyty | 1 | 33% (z 3) | `c7ee170` |
| Właściciele + `model` | 1 | 33% (z 3) | `fd4361b` |
| Zwierzęta + Wizyty | 1 | 33% (z 3) | `c7ee170` |
| Zwierzęta + `model` | 1 | 33% (z 3) | `fd4361b` |
| Zwierzęta + `system` | 1 | 50% (z 2) | `51045d1` |
| Zwierzęta + `db` | 1 | 25% (z 4) | `e0db9b1` |
| Zwierzęta + Testy integracyjne | 1 | 20% (z 5) | `e0db9b1` |
| Zwierzęta + `service` | 1 | 100% (z 1) | `e0db9b1` |
| `db` + Testy integracyjne | 1 | 25% (z 4) | `e0db9b1` |
| Testy integracyjne + Korzeń aplikacji | 1 | 50% (z 2) | `9a5d50c` |
| Wizyty + Tłumaczenia | 1 | 33% (z 3) | `753d35c` |
| Wizyty + `system` | 1 | 50% (z 2) | `753d35c` |
| Tłumaczenia + `system` | 1 | 50% (z 2) | `753d35c` |

Pary z `service` mają 100%, ale to artefakt jednego commitu.

### Trójki

| Trójka | Wspólne commity | Commit i charakter |
|--------|:---:|------------|
| Właściciele + Zwierzęta + Wizyty | 1 | `c7ee170`: ta sama linijka `setDisallowedFields("id", "*.id")` w trzech kontrolerach. |
| Właściciele + Zwierzęta + `model` | 1 | `fd4361b`: nazwy kolumn snake_case w encjach. |
| Wizyty + Tłumaczenia + `system` | 1 | `753d35c`: walidacja daty wizyty, nowy klucz komunikatu w `messages_*` i komunikat błędu we fragmencie `inputField.html`. |
| Zwierzęta + `db` + Testy integracyjne (+ `service`) | 1 | `e0db9b1`: unikalne imię zwierzęcia, czyli sprawdzenie w `PetController`, indeks w trzech schematach i testy współbieżności. |

### Sprzężenia wewnątrz katalogów

Te sprzężenia są ukryte przez grupowanie obszarów.

- **Kod produkcyjny i testy `owner/`:** 7 wspólnych commitów, 70% z 10 commitów w `src/test/.../owner/`. W bazie z e) `src/main/.../owner/` też ma 10 commitów, więc 7 z 10 zmian kodu `owner/` przyszło z testem. To zdrowe sprzężenie.
- **Schematy `db/h2`, `db/mysql` i `db/postgres`:** w oknie razem tylko raz (`e0db9b1`). Jedyna pozostała zmiana schematów aktywnych dialektów (`88e37c1`) dotyczyła wyłącznie `postgres/schema.sql`. Usunięcie HSQLDB w `2beb238` tu nie liczę. Ten sam commit naprawiał regresję opisaną w d). To sprzężenie *oczekiwane, ale niewymuszone*: trzy dialekty muszą się zmieniać razem, a nic tego nie pilnuje.

### Wnioski dla TOP 3 obszarów

1. **Właściciele:** najsilniej związani ze zwierzętami (3 commity, 43%).
   - Źródło sprzężenia to wspólny pakiet `owner/` i wspólny agregat. `Owner.addPet` należy do obu, a kontrolery mają ten sam szablon bindera.
   - Fakt: w `c7ee170` ta sama zmiana bindera trafiła do wszystkich trzech kontrolerów naraz. To jeden commit, więc nie dowodzi trwałej zależności. Rekomendacja: przy zmianie bindera w `OwnerController` sprawdzić `Pet*` i `Visit*`.
   - Z `vet/` łączy ich tylko skopiowana logika paginacji: wspólny `500158f` oraz para osobnych, identycznych commitów `0d064b0`/`b33136f`. W oknie wszystkie trzy poprawki paginacji zrobiono w obu kontrolerach. To duplikacja, a nie zależność domenowa.
2. **Zwierzęta:** obszar o największej liczbie partnerów: właściciele, wizyty, `model`, `system`, `db`, testy integracyjne i serwisowe.
   - Tylko z właścicielami sprzężenie się powtarza. Reszta to pojedyncze commity, głównie feature `e0db9b1`.
   - Obserwacja z jednego commitu (`e0db9b1`): reguła domenowa o zwierzęciu (unikalność) wymagała zmian w `PetController`, w trzech schematach `db/` i w testach integracyjnych naraz. `PetValidator` i `Pet.java` nie były zmieniane (`git show --stat e0db9b1`). To najszerszy ślad pojedynczego feature'u w oknie.
3. **Testy integracyjne:** w zasadzie bez sprzężeń funkcjonalnych.
   - Zmieniają się samodzielnie (`edf4db2`, `e316074`, `a4fcf04`) albo razem z upgrade'ami (`9a5d50c`, `37d5315`).
   - Wyjątkiem jest `e0db9b1` z nowym testem współbieżności.
   - Zgodnie z c): połowa commitów tego obszaru (3 z 6) to upgrade'y, reszta to konfiguracja i jeden feature. Obszar nie ma powtarzalnego partnera wśród funkcji produktu.

**Ogólnie:** jedynym powtarzalnym sprzężeniem między obszarami jest para właściciele–zwierzęta (3 commity). Pozostałe pary występują w pojedynczych commitach, więc przy tej próbce nie dowodzą trwałej zależności. Najważniejsze ryzyko leży w sprzężeniu, którego w historii *brakuje*: trzy dialekty schematu powinny zmieniać się razem, a zmieniły się razem tylko w połowie zmian schematu.

## f) Pliki-węzły i aktualność sprzężeń

### Czy jakiś plik zmienia się razem z wieloma obszarami?

Dla każdego pliku policzyłem, z iloma *innymi* obszarami produktu dzielił commity. Wziąłem 47 commitów bez merge, tym razem łącznie z plikami buildu i konfiguracji, które gdzie indziej odfiltrowuję. Wariant drugi to ta sama baza bez szerokich commitów: `44d5f21`, `37c7f98` i `37d5315`.

| Plik | Commity | Obszary (wszystkie commity) | Obszary (bez szerokich) | Jak powstają zmiany |
|------|:---:|:---:|:---:|---------------------|
| `pom.xml` | 10 | **9** | 2 | Ręcznie |
| `owner/PetController.java` | 4 | 9 | **5** | Ręcznie |
| `owner/OwnerController.java` | 5 | 6 | 3 | Ręcznie |
| `README.md` | 9 | 5 | 2 | Ręcznie (dokumentacja) |
| `src/main/resources/application.properties` | 3 | 4 | 4 | Ręcznie |

Liczby commitów w tej tabeli są z innej bazy niż w b) (47 commitów z buildem i commitami masowymi zamiast 28 po filtrach). Dlatego `OwnerController` ma tu 5, a w b) 4, a `PetController` tu 4, a w b) 2.

**`pom.xml` to jedyny prawdziwy węzeł.**
- Ma 10 commitów, najwięcej ze wszystkich plików w oknie, i łączy się z 9 z 11 obszarów. 7 z tych 9 połączeń pochodzi jednak z dwóch szerokich commitów, które dotykają `pom.xml`: `37d5315` (Boot 4.0) i `37c7f98` (zależności i nazwy testów). Bez nich zostają 2 obszary (korzeń aplikacji i testy integracyjne, oba z `9a5d50c`).
- Pozostałe 8 commitów dotyka głównie samego `pom.xml`: podbicia Bootu 4.0.1 i 4.1, Java 17, starter, zależności testowe i dwa reverty.
- **Edycja jest ręczna.** Autorami są wyłącznie maintainerzy (Nicoll, Syer, Baumgartner). Repo nie ma `dependabot.yml` ani konfiguracji Renovate, a w `.github/` jest tylko `dco.yml` i workflowy. Żaden bot nie dotknął `pom.xml` w oknie.
- **Jedyne pliki zmieniane automatycznie to wrappery:** `gradle/wrapper/gradle-wrapper.jar`, `gradlew`, `gradlew.bat`, `gradle-wrapper.properties` i `.mvn/wrapper/maven-wrapper.properties` w `9a5d50c`. Generuje je `./gradlew wrapper` lub `mvn wrapper:wrapper`. Wchodzą do repo razem z ręcznym podbiciem wersji, ale same nie są sprzężone z żadnym obszarem produktu.

**`PetController.java`: pozorny węzeł.** 5 obszarów bez szerokich commitów wynika z zaledwie dwóch commitów:
- `e0db9b1`: feature dotykający `db`, testów i serwisu,
- `c7ee170`: ta sama linijka bindera w trzech kontrolerach.

To nie jest plik, przez który przechodzą zmiany wielu funkcji.

**`application.properties`: mały, ale realny węzeł konfiguracyjny.** 3 ręczne commity zmieniają zachowanie JPA dla wszystkich encji naraz:
- strategia nazw snake_case (`fd4361b`),
- `default_batch_fetch_size` (`e316074`),
- komentarz o actuatorach (`f1e0e22`).

Zmiana tutaj ma szeroki zasięg, choć w historii wygląda na zmianę w jednym pliku.

### Czy mocno sprzężone pliki nadal istnieją?

Sprawdziłem wszystkie pliki z commitów, które tworzą pary i trójki w e) (`676db04`, `c7ee170`, `fd4361b`, `500158f`, `51045d1`, `e0db9b1`, `9a5d50c`, `753d35c`), oraz pozostałe commity `db/` (`88e37c1`, `2beb238`, `8f08b38`).

- **Istnieje wszystko, co tworzy sprzężenia z e):** encje i kontrolery `owner/`, `VetController`, `NamedEntity`, `Person`, `PetClinicRuntimeHints`, trzy `schema.sql`, `mysql/user.sql`, `messages*.properties`, `fragments/inputField.html` i wszystkie testy. Żaden z nich nie zmienił nazwy ani położenia (`git log -M --diff-filter=R` jest pusty).
- **Usunięte w oknie:**
  - `db/hsqldb/schema.sql` i `db/hsqldb/data.sql` (`2beb238`, „Remove outdated references to HSQLDB”). Do usunięcia był to czwarty dialekt schematu, który teoretycznie należało zmieniać razem z h2, mysql i postgres. Nie tworzy żadnej pary w e), bo jedynym commitem, który go dotknął, było samo usunięcie.
  - `.mvn/jvm.config` i `.sdkmanrc` (`828940e`): konfiguracja buildu, bez związku z obszarami produktu.

**Wniosek:** sprzężenia z sekcji e) dotyczą żywego kodu, więc nadal obowiązują. Ostatnia zmiana zmniejszyła liczbę dialektów schematu z czterech do trzech, ale problem „trzy pliki schematu muszą zmieniać się razem” pozostaje.
