<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Reguła unikalności imienia zwierzęcia jako metoda agregatu `Owner`

- **Plan**: context/changes/refactor-opportunities/plan.md
- **Mode**: Deep
- **Date**: 2026-11-23
- **Verdict**: REVISE → SOUND po triage
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding
6/6 ścieżek ✓, 5/5 symboli ✓ (`getPet(String, boolean)`, `Objects` tylko `PC:20,153`, `isNew()` = `id == null`, `@OrderBy("name")`, 5 użyć `getPet(String)` w testach), brief↔plan ✓, Progress↔Fazy ✓. Weryfikacja kodu wykonana bezpośrednio, bez sub-agenta: prześledzone przypadki testowe faz 1, 2 i 5 na obecnym kodzie.

## Findings

### F1 — Faza 5 łamie twardą regułę „zmiana zachowania = osobna zmiana”

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Faza 5; Desired End State; Implementation Approach
- **Detail**: CLAUDE.md: „A refactor phase that changes observable behaviour is a separate change.” Plan sam nazywał fazę 5 („wszystkie trafienia”) jedyną zmianą zachowania, a mimo to trzymał ją w tej samej zmianie i traktował „osobną” jako osobny commit.
- **Fix A ⭐ Recommended**: Wydzielić fazę 5 do osobnej zmiany; plan kończy się na fazie 4.
  - Strength: Zgodność z dosłownym brzmieniem reguły; ta zmiana jest czystym refaktorem.
  - Tradeoff: Dodatkowy folder i plan; C4 domknięte później.
  - Confidence: HIGH — faza 5 zależała tylko od `hasOtherPetNamed`.
  - Blind spot: Przypięty test „pierwsze trafienie → false” zostaje do czasu kolejnej zmiany.
- **Fix B**: Zostawić fazę 5 z jawnym wyjątkiem w Key Decisions.
  - Strength: C4 domknięte w jednym miejscu.
  - Tradeoff: Świadome odstępstwo od twardej reguły.
  - Confidence: MED — zależy od interpretacji „separate change”.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A) — faza 5 usunięta z planu i Progress, szkic zapisany w sekcji „Kolejna zmiana: „wszystkie trafienia””, brief zaktualizowany.

### F2 — „Świeży Owner z tymi samymi zwierzętami”: współdzielone obiekty Pet psują guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 1, Change 2 (Contract)
- **Detail**: Gdyby `willAnswer` tworzył nowego Ownera z tymi samymi obiektami `Pet`, binding w `findPet` zmieniłby imię również na liście ownera z `findOwner`. Przy kolejności doggy(2), petty(1) edycja pet 2 na „petty” dałaby redirect, więc kryterium 1.1 byłoby czerwone na niezmienionym kodzie.
- **Fix**: W kontrakcie dopisać, że każde `findById` buduje nowe instancje `Owner` i `Pet` (fabryka `freshOwner(order)`).
- **Decision**: FIXED
