# Unknowns: gdzie graf jdeps nie widzi zależności

jdeps widzi tylko referencje typów w bytecode. Wszystkie pozycje poniżej to zależności, które **istnieją**, ale powstają w runtime, w napisach albo poza Javą. Brak krawędzi w `package/`, `class/` i `class-full/` w tych miejscach to **unknown**, a nie dowód braku powiązania.

Ścieżki Java są względne do `src/main/java/org/springframework/samples/petclinic/`, a zasoby do `src/main/resources/`.

Rodzaje luk:
- **R**: runtime (kontener, proxy, refleksja),
- **S**: powiązanie przez napis,
- **K**: konfiguracja lub profil,
- **P**: plik spoza Javy (SQL, HTML, SCSS),
- **A**: wartość adnotacji.

## 1. Wstrzykiwanie zależności Springa

| # | Ścieżka | Co łączy | Luka | Weryfikacja |
|---|---------|----------|:---:|-------------|
| U1 | `PetClinicApplication.java` (`@SpringBootApplication`) | Skanowanie komponentów rejestruje 6 `@Controller`, `PetTypeFormatter` (`@Component`), `CacheConfiguration`, `WebConfiguration` oraz repozytoria Spring Data. jdeps nie widzi, że te klasy w ogóle trafiają do aplikacji. | R | `GET /actuator/beans` (actuator jest włączony: `management.endpoints.web.exposure.include=*`) albo `./mvnw spring-boot:run -Dspring-boot.run.arguments=--debug` (raport warunków auto-konfiguracji) |
| U2 | `system/CacheConfiguration.java` (`@Bean JCacheManagerCustomizer`) | Tworzy cache `"vets"` przez `cm.createCache("vets", …)`. Konsumentem jest `vet/VetRepository.java` (`@Cacheable("vets")` na obu `findAll`). Tych klas nie łączy żadna krawędź. | S, R | `grep -rn '"vets"' src/main/java`. W runtime: `GET /actuator/caches`. Test: `CacheManager.getCache("vets")` w `@SpringBootTest`. |
| U3 | `system/WebConfiguration.java` (`@Bean LocaleResolver`, `LocaleChangeInterceptor`) | Interceptor z parametrem `lang` działa dla każdego żądania i każdego kontrolera. Domyślny język to angielski, a wybór jest pamiętany w sesji. | R, S | `curl -i 'localhost:8080/?lang=de'` i sprawdzenie tekstu strony. Żaden test nie używa `?lang=`. |
| U4 | `owner/PetTypeFormatter.java` (`@Component Formatter<PetType>`) | Spring MVC rejestruje go automatycznie w konwersji formularzy. W kodzie Ca = 0, ale **każde** wiązanie pola `PetType` w formularzu przechodzi przez tę klasę. | R | `PetControllerTests` musi go dołączyć przez `includeFilters`, co samo w sobie dowodzi powiązania. W runtime: `/actuator/beans`. |
| U5 | `owner/PetController.java:96` (`new PetValidator()` w `@InitBinder("pet")`) | Walidator jest podpinany do bindera tylko dla atrybutu `"pet"`. jdeps pokaże krawędź, ale nie to, że zależy ona od nazwy atrybutu modelu. | S | Przeczytać `@InitBinder` w `PetController` i porównać z `@ModelAttribute("pet")`. |
| U6 | `PetClinicApplication.java:29` (`@ImportRuntimeHints(PetClinicRuntimeHints.class)`), testy `@WebMvcTest(X.class)` | Wartości adnotacji nie są krawędziami jdeps, więc `Ca_test = 0` dla wszystkich kontrolerów to fałszywe zero. | A | `grep -rn '@WebMvcTest' src/test/java` |

## 2. Spring Data

| # | Ścieżka | Co łączy | Luka | Weryfikacja |
|---|---------|----------|:---:|-------------|
| U7 | `owner/OwnerRepository.java:45` (`findByLastNameStartingWith(String, Pageable)`) | Nazwa metody tworzy zapytanie na polu `lastName` z `model/Person.java`. Zmiana nazwy pola psuje start aplikacji, a nie kompilację. Wielkość liter: w H2 kolumna `owners.last_name` ma typ `VARCHAR_IGNORECASE`, a w MySQL i Postgres zależy od collation. | S, P | Start aplikacji (Spring Data waliduje zapytania przy starcie). `ClinicServiceTests.shouldFindOwnersByLastName` na każdym profilu. Porównanie `db/*/schema.sql` dla `last_name`. |
| U8 | `owner/PetTypeRepository.java:36` (`@Query("SELECT ptype FROM PetType ptype ORDER BY ptype.name")`) | JPQL jako tekst odwołuje się do encji `PetType` i pola `name` z `NamedEntity`. | S | `grep -rn '@Query' src/main/java`. Hibernate waliduje JPQL przy starcie, więc test `@DataJpaTest` to złapie. |
| U9 | `vet/VetRepository.java:46`, `:56` (`findAll()`, `findAll(Pageable)`) | Metody pochodne z bazowego `Repository`. Obie trafiają do cache `"vets"` pod różnymi kluczami (`SimpleKey.EMPTY` i `Pageable`). Brak `@CacheEvict`, więc zmiana danych weterynarzy w bazie nie jest widoczna do restartu. | R, S | `GET /actuator/caches`. Sprawdzić, czy jakakolwiek ścieżka zapisu weterynarzy istnieje (dziś nie ma). |
| U10 | `owner/Owner.java:67`, `owner/Pet.java:52`, `:56`, `vet/Vet.java:47` (`@OneToMany`, `@ManyToOne`, `@ManyToMany`, `cascade = ALL`, `fetch = EAGER`) | Kaskada zapisuje zwierzęta i wizyty przez `owners.saveAndFlush(owner)`. EAGER ładuje cały agregat. Działa to razem z `spring.jpa.open-in-view=false` i `default_batch_fetch_size=16` z `application.properties`. | R, K | `logging.level.sql=DEBUG` (już ustawione w `PetClinicIntegrationTests`) i odczyt zapytań przy `GET /owners/1` oraz zapisie wizyty. |

## 3. Szablony Thymeleaf

| # | Ścieżka | Co łączy | Luka | Weryfikacja |
|---|---------|----------|:---:|-------------|
| U11 | Nazwy widoków w kontrolerach → `templates/` | `"owners/createOrUpdateOwnerForm"`, `"owners/findOwners"`, `"owners/ownersList"`, `"pets/createOrUpdatePetForm"`, `"pets/createOrUpdateVisitForm"`, `"vets/vetList"`, `"welcome"`. `error.html` jest używany przez Boot bez żadnego odwołania z kodu. Literówka w nazwie widoku nie psuje kompilacji. | S, P | `grep -rnE 'return "\|VIEWS_' src/main/java` i porównanie z `find src/main/resources/templates -name '*.html'`. Testy `@WebMvcTest` sprawdzają `view().name(...)`, ale nie to, że szablon istnieje. |
| U12 | Przekierowania między kontrolerami | `redirect:/owners/{ownerId}` w `PetController` (`:136`, `:178`) i `VisitController:111` prowadzi do `OwnerController`. `redirect:/owners`, `redirect:/owners/{ownerId}/edit`, `redirect:/vets.html`. To graf nawigacji, którego jdeps nie widzi. | S | `grep -rn 'redirect:' src/main/java`. Mapowania endpointów: `GET /actuator/mappings`. |
| U13 | Atrybuty modelu ↔ szablony | `listOwners`, `listVets`, `currentPage`, `totalPages`, `totalItems` (paginacja, skopiowana w `OwnerController` i `VetController`), `types`, `owner`, `pet`, `visit`, `minVisitDate`. Szablony odwołują się do nich przez `${…}`. | S | `grep -rhoE '\$\{[a-zA-Z]+' src/main/resources/templates \| sort \| uniq -c` i porównanie z `grep -rn 'addAttribute\|@ModelAttribute\|model.put' src/main/java` |
| U14 | Pola encji ↔ `th:field` | `*{lastName}`, `*{address}`, `*{city}`, `*{telephone}`, `*{id}` oraz dynamiczne `*{__${name}__}` w `fragments/inputField.html` (`name`, `birthDate`, `date`, `description`). Getterów `pet.visits`, `pet.type`, `owner.pets`, `vet.specialties`, `vet.nrOfSpecialties` (`Vet.getNrOfSpecialties()`) i `${…['new']}` (`BaseEntity.isNew()`) używa tylko szablon. | S, P | Wyszukać każdy getter w `templates/` przed zmianą nazwy. `${x['new']}` szukać jako `\['new'\]`. |
| U15 | `templates/fragments/inputField.html` (`th:min="${minVisitDate}"` na każdym polu `date`) | Wspólny fragment czyta atrybut, który ustawia **tylko** `VisitController:83`. W formularzu zwierzęcia (`birthDate`) atrybut jest pusty. Fragment z `system` zależy więc ukrycie od kontrolera wizyt. | S | Otworzyć `/owners/1/pets/new` i `/owners/1/pets/1/visits/new` i porównać atrybut `min` pola daty. |
| U16 | `fragments/layout.html`, `fragments/selectField.html` | Layout wszystkich stron (menu, linki `@{/owners}`, `@{/vets.html}`, webjars, `petclinic.css`). `selectField` używany tylko dla `type` w formularzu zwierzęcia, razem z `PetTypeFormatter` (U4). | P, S | `grep -rn 'th:replace\|th:insert' src/main/resources/templates` |
| U17 | Klucze i18n ↔ `messages/messages*.properties` | 57 miejsc `#{…}` w szablonach. Do tego klucz błędu walidacji dodany w `753d35c`. Strukturę kluczy pilnuje `I18nPropertiesSyncTest`, a nie kompilator. **Przy okazji:** `pets/createOrUpdatePetForm.html` ma tekst na sztywno (`'Add Pet'`, `'Update Pet'`), a etykiety pól w `th:replace` (`'Name'`, `'Birth Date'`, `'Type'`, `'Date'`, `'Description'`) też nie są kluczami. To łamie zasadę z `AGENTS.md`. | S, P | `./mvnw test -Dtest=I18nPropertiesSyncTest`. `grep -rnE "th:(text\|with)=\"[^\"]*'[A-Z]" src/main/resources/templates` |

## 4. Profile, konfiguracja i cache

| # | Ścieżka | Co łączy | Luka | Weryfikacja |
|---|---------|----------|:---:|-------------|
| U18 | `application.properties` (`database=h2`, `spring.sql.init.schema-locations=classpath*:db/${database}/schema.sql`) i `application-{mysql,postgres}.properties` (`database=…`) | Profil wybiera **katalog** skryptów SQL przez napis `${database}`. Graf klas jest taki sam dla wszystkich trzech baz, a schemat i dane nie. | K, P | `./mvnw spring-boot:run -Dspring-boot.run.profiles=postgres` i `GET /actuator/env`. Porównanie `diff db/h2/schema.sql db/postgres/schema.sql`. |
| U19 | `application-{mysql,postgres}.properties` (`spring.sql.init.mode=always`) | Na trwałej bazie schemat wykonuje się przy **każdym** starcie. To przyczyna regresji `88e37c1`. H2 działa w pamięci, więc tego nie wykryje. | K, P | Uruchomić aplikację dwa razy na tym samym kontenerze: `docker compose up postgres`, potem dwa razy `spring-boot:run` z profilem `postgres`. |
| U20 | `application.properties` (`physical-strategy=…SnakeCaseImpl`) | Nazwy kolumn powstają z nazw pól Java w runtime (`birthDate` → `birth_date`). Zmiana nazwy pola zmienia kolumnę bez żadnego śladu w grafie. | K, R | Logi SQL (`logging.level.sql=DEBUG`) i porównanie z `schema.sql`. |
| U21 | `application.properties` (`spring.messages.basename=messages/messages`, `spring.web.resources.cache.cachecontrol.max-age=12h`, `management.endpoints.web.exposure.include=*`) | Lokalizacja tłumaczeń, cache przeglądarki dla statycznych plików i wystawienie wszystkich endpointów actuatora. Działają globalnie. | K | `GET /actuator/env`. Nagłówek `Cache-Control` w `curl -I localhost:8080/resources/css/petclinic.css`. |
| U22 | `docker-compose.yml`, `MySqlIntegrationTests` (`@Testcontainers(disabledWithoutDocker = true)`), `PostgresIntegrationTests` (`spring.docker.compose.skip.in-tests=false`) | Testy na prawdziwych bazach zależą od środowiska i znikają po cichu bez Dockera. | K, R | `./mvnw test -Dtest='MySqlIntegrationTests,PostgresIntegrationTests'` i sprawdzenie w raporcie Surefire, czy testy były `skipped`. |

## 5. Skrypty SQL

| # | Ścieżka | Co łączy | Luka | Weryfikacja |
|---|---------|----------|:---:|-------------|
| U23 | `db/{h2,mysql,postgres}/schema.sql` | Tabele, długości kolumn (`first_name`/`last_name` 30, `pets.name` 30, `types.name` i `specialties.name` 80) i indeks `unique_owner_pet_name`. Muszą zgadzać się z `@Size` i `@Column` w encjach, a nic tego nie sprawdza automatycznie. | P | `grep -n 'VARCHAR\|INDEX\|UNIQUE' src/main/resources/db/*/schema.sql` i porównanie z `grep -rn '@Size\|@Column' src/main/java` |
| U24 | `owner/PetController.java:202–205` (`isDuplicatePetNameViolation`) ↔ `schema.sql` | Kontroler rozpoznaje błąd po napisie `"unique_owner_pet_name"` w komunikacie sterownika. Testy kontrolera podają własny komunikat. | S, P | Wywołać duplikat imienia na MySQL i Postgres i zapisać prawdziwy `ex.getMessage()`. |
| U25 | `db/*/data.sql` | Dane startowe: typy zwierząt (wartości `<select>` przez `PetTypeFormatter`), właściciel `id=1` (używany przez testy integracyjne `GET /owners/1`) i weterynarze w cache. | P | `grep -n 'INSERT INTO types' src/main/resources/db/*/data.sql`. Testy integracyjne zakładają istnienie `id=1`. |
| U26 | `db/mysql/user.sql`, `db/*/petclinic_db_setup_*.txt` | Ręczne przygotowanie bazy. Nie jest wykonywane przez aplikację. | P | Lektura plików. Raport terytorium: `8f08b38` naprawiał `user.sql` dla MySQL 8+. |

## 6. Runtime hints, refleksja i walidacja

| # | Ścieżka | Co łączy | Luka | Weryfikacja |
|---|---------|----------|:---:|-------------|
| U27 | `PetClinicRuntimeHints.java:29–31` (`registerPattern("db/*")`, `"db/*/*"`, `"messages/*"`) | Wzorce zasobów dla obrazu natywnego wiążą się z układem katalogów `db/` i `messages/` przez napis. | S, P | Build natywny: `./mvnw -Pnative native:compile` (wymaga GraalVM). W CI nie ma workflowu natywnego. |
| U28 | `PetClinicRuntimeHints.java:32` (`registerPattern("mysql-default-conf")`) | **Wzorzec wskazuje zasób, którego nie ma w repo.** `find . -name 'mysql-default-conf*'` niczego nie znajduje. Hint jest martwy albo odnosi się do pliku dostarczanego z zewnątrz. | S | `find . -name 'mysql-default-conf*' -not -path './target/*'` i `git log -S mysql-default-conf` (skąd się wziął). |
| U29 | `PetClinicRuntimeHints.java:33–35` (`withJavaSerialization` dla `BaseEntity`, `Person`, `Vet`) | Serializacja Javy dla wartości cache JCache (`Vet` w `"vets"`). Lista jest ręczna, więc nowa encja w cache wymaga ręcznego dopisania. | R | Jak U27. Zobacz też U36: nie jest pewne, czy w runtime w ogóle działa JCache. |
| U30 | Bean Validation w encjach: `model/Person.java` (`@Size(max = 30)`, `@NotBlank`), `NamedEntity` (`@NotBlank`), `owner/Owner.java` (`@Size(max = 255)`, `@Size(max = 80)`, `@Pattern(regexp = "\\d{10}", message = "{telephone.invalid}")`), `owner/Visit.java` (`@Size(max = 255)`). Limit imienia zwierzęcia (30) jest **w `PetValidator`, a nie w adnotacji** (`676db04`). | Walidację uruchamia `@Valid` w kontrolerach przez refleksję. Klucz `{telephone.invalid}` jest rozwiązywany z `messages*.properties` (pliku `ValidationMessages` nie ma). Reguły długości są więc w dwóch mechanizmach: adnotacjach i ręcznym walidatorze. | R, A, S | `model.ValidatorTests` (wzorzec testu bez Springa). `grep -rn '@Valid\|@Size\|@Pattern' src/main/java` i `grep -n 'telephone.invalid' src/main/resources/messages/*.properties` |
| U31 | `@DateTimeFormat(pattern = "yyyy-MM-dd")` w `owner/Pet.java:49`, `owner/Visit.java:40` | Format daty z formularza (`<input type="date">` w `inputField.html`) jest zdefiniowany w encji. | A, P | Ręczny test formularza albo `@WebMvcTest` z `param("birthDate", "…")`. |
| U32 | `@XmlRootElement` / `@XmlElement` w `vet/Vets.java`, `vet/Vet.java:59` i `@ResponseBody` w `VetController:73` (`GET /vets`) | Kształt odpowiedzi JSON i XML zależy od getterów i adnotacji, a nie od typów. XML nie jest testowany. | A, R | `curl -H 'Accept: application/xml' localhost:8080/vets` i `curl -H 'Accept: application/json' localhost:8080/vets` |
| U36 | `system/CacheConfiguration.java` (`JCacheManagerCustomizer`) ↔ classpath | **Hipoteza, niezweryfikowana.** W `target/cp.txt` jest `javax.cache:cache-api` i rdzeń `com.github.ben-manes.caffeine:caffeine:3.2.4`, ale **nie ma** modułu `com.github.ben-manes.caffeine:jcache`, który dostarcza JCache `CachingProvider`. Jeśli żaden provider JCache nie jest dostępny, Boot może wybrać natywny `CaffeineCacheManager`. Wtedy customizer z `CacheConfiguration` się nie wykona: cache `"vets"` powstanie dynamicznie bez statystyk, a hinty serializacji z U29 nie będą potrzebne. Graf pokazuje `system -> javax.cache`, ale nie to, czy ten kod działa. | R, K | `GET /actuator/caches` (pole `cacheManagers` podaje bean i typ menedżera) albo `--debug` i sekcja `JCacheCacheConfiguration` w raporcie warunków. Dodatkowo `tr ';' '\n' < target/cp.txt \| grep -i caffeine`. |

## 7. Pliki statyczne i SCSS (profil `css`)

| # | Ścieżka | Co łączy | Luka | Weryfikacja |
|---|---------|----------|:---:|-------------|
| U33 | `src/main/scss/{petclinic,header,responsive,typography}.scss` → `static/resources/css/petclinic.css` | `libsass-maven-plugin` w profilu `css` (`pom.xml`). `petclinic.scss` robi `@import "bootstrap"` ze źródeł Bootstrapa rozpakowanych z webjara do `target/webjars`. CSS jest **plikiem w repo**, więc zmiana SCSS bez `-P css` nie zmienia aplikacji. | P, K | `./mvnw package -P css`, potem `git diff --stat src/main/resources/static/resources/css/`. |
| U34 | `build.gradle` | **Nie ma odpowiednika profilu `css`**: `grep -i scss build.gradle` niczego nie zwraca. Build Gradle nie potrafi przebudować CSS. To odstępstwo od zasady „zmiany w `pom.xml` mają odpowiednik w `build.gradle`”. | K | `grep -n -i 'scss\|sass' build.gradle` |
| U35 | `fragments/layout.html` ↔ `static/resources/` i webjars | `@{/resources/css/petclinic.css}`, `@{/resources/images/*}`, `@{/webjars/bootstrap/...}`, `@{/webjars/font-awesome/...}`. Wersje Bootstrapa w SCSS (`webjars-bootstrap.version`) i w runtime (`org.webjars.npm:bootstrap`) muszą się zgadzać. | P, K | `curl -I localhost:8080/webjars/bootstrap/dist/js/bootstrap.bundle.min.js`. Porównać wersje w `pom.xml` i `build.gradle`. |

## Najważniejsze unknowns dla aktywnych obszarów

| Obszar z `artifact-1-territory.md` | Unknowns | Dlaczego ma znaczenie |
|------------------------------------|----------|-----------------------|
| Właściciele | U7, U11–U14, U20, U23 | Pola `Person` i `Owner` są związane z zapytaniem po nazwie, szablonem, strategią nazw i trzema schematami. 5 poprawek w oknie dotyczyło właśnie brzegów wejścia. |
| Zwierzęta | U4, U5, U10, U15, U17, U24, U25 | Reguła unikalności (U24), formatter (U4) i wspólny fragment z `minVisitDate` (U15) są niewidoczne w grafie. |
| Wizyty | U10, U12, U15, U17, U31 | Zapis przez kaskadę, przekierowanie do właściciela i fragment daty. `753d35c` zmienił jednocześnie encję, kontroler, 8 plików `messages_*` i fragment. |
| Weterynarze | U2, U9, U29, U32, U36 | Cache `"vets"` (napis + serializacja + hint) i XML. W grafie `vet` wygląda na najprostszy pakiet, a ma najwięcej powiązań runtime. |
| Skrypty `db/` | U18, U19, U23–U26 | Jedyna regresja w oknie (`88e37c1`) pochodzi z U19. Graf nie widzi żadnej z tych zależności. |

## Weryfikacja (2026-11-20, po powstaniu listy)

| # | Status | Jak sprawdzone |
|---|--------|----------------|
| U17 | **Potwierdzone, szerzej niż opisano.** Etykiety na sztywno są w `templates/pets/createOrUpdatePetForm.html` (`'Name'`, `'Birth Date'`, `'Type'`) i w `templates/pets/createOrUpdateVisitForm.html` (`'Date'`, `'Description'`). | `grep th:replace` w szablonach. |
| U28 | **Potwierdzone.** Zasobu nie ma. Wzorzec dodał `c231682` (2023-07-07, „Tidy up native tests”) i od tamtej pory nikt go nie zmieniał. | `find`, `git log -S mysql-default-conf` |
| U34 | **Potwierdzone i rozszerzone.** W `build.gradle` nie ma też JaCoCo, `build-info`, `git-commit-id` ani czterech zależności `*-test`. | porównanie `pom.xml` i `build.gradle` |
| U36 | **Potwierdzone.** Menedżer to `CaffeineCacheManager` (`CaffeineCacheConfiguration`), a nie JCache. Cache `vets` powstaje dynamicznie przy pierwszym żądaniu. | `/actuator/beans`, `/actuator/caches` na uruchomionej aplikacji (H2); JaCoCo: linie 37 i 50 w `CacheConfiguration` niewykonane w 81 testach |
