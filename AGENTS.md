# Repository Guidelines

Spring PetClinic: a Spring Boot 4.1 sample app (Java 17, Spring Data JPA, Thymeleaf) built with Maven or Gradle. Runs on in-memory H2 by default; MySQL and PostgreSQL via Spring profiles.

## Hard Rules

- The build fails on format violations. Run `./mvnw spring-javaformat:apply` before committing Java.
- No plain-HTTP URLs anywhere in the repo (localhost excepted); nohttp checkstyle (`src/checkstyle/nohttp-checkstyle.xml`) fails `validate`. Use `https://` or add a suppression.
- No hardcoded user-visible text in templates or Java. Use `th:text="#{key}"` and add the key to `messages.properties` **and every** `messages_*.properties`; `I18nPropertiesSyncTest` enforces both.
- Schema changes go into all three `src/main/resources/db/{h2,mysql,postgres}/schema.sql` files. Hibernate `ddl-auto=none` never generates tables.
- Every commit needs a `Signed-off-by:` trailer (DCO). Use `git commit -s`.

## Build, Test, and Development Commands

- `./mvnw spring-boot:run`: start at http://localhost:8080 (H2).
- `./mvnw -B verify`: full CI gate (format, nohttp, tests, JaCoCo). Must pass before push.
- `./mvnw test -Dtest=OwnerControllerTests`: run a single test class.
- `./mvnw package -P css`: recompile `petclinic.css` after editing `src/main/scss/`.
- `docker compose up mysql|postgres`: start a database, then run with `spring.profiles.active=mysql|postgres`.

Every dependency or version added or changed in `pom.xml` needs a matching change in `build.gradle` in the same commit; CI runs `./gradlew build` separately (gradle-build.yml).

## Project Structure

Feature packages under `src/main/java/org/springframework/samples/petclinic/`: `owner/` (owners, pets, visits), `vet/`, `system/` (config, welcome, error), `model/` (shared `BaseEntity`, `NamedEntity`, `Person`). Each feature keeps its entity, `*Repository`, and `*Controller` together. Templates live in `src/main/resources/templates/<feature>/`.

## Coding Style

- Indentation per @.editorconfig.
- New source files start with the Apache 2.0 license header copied from any existing class.
- Bean Validation limits (`@Size`, etc.) must match the column lengths in `schema.sql`.

## Testing

Tests mirror the main package layout in `src/test/java/...`, named `*Tests.java`. Controller tests use `@WebMvcTest`. `MySqlIntegrationTests` (Testcontainers) and `PostgresIntegrationTests` (Docker Compose) need a running Docker daemon.

## Commits

Subject line in imperative mood, max 72 characters, no trailing period, e.g. `Validate visit description length` (f3c7483). Add a `fix:`/`test:`/`i18n:`/`docs:` prefix only when the change touches that area alone.
