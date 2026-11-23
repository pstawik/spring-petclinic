---
title: Słownik domeny dla agentów — Spring PetClinic
created: 2026-11-23
type: glossary
---

# Słownik domeny

Krótki słownik dla agentów pracujących w tym repo. Dowody i źródła: `01-domain-distillation.md`.

| Termin | Co znaczy | Nazwa w kodzie | Jak tego NIE nazywać |
|---|---|---|---|
| Pacjent | Zwierzę (też gospodarskie, egzotyczne albo stado), któremu prowadzimy dokumentację | `Pet` | `Animal` jako encja ogólna, `Customer`. Nie mieszać z klientem |
| Opiekun / Klient | Osoba lub firma odpowiedzialna za pacjenta: decyduje, podpisuje zgody, płaci | `Owner` | `User` (to pracownik), `Patient`. Nie zakładać, że `Owner` to jedyna rola |
| Termin | Rezerwacja w kalendarzu, która może się nie odbyć | brak (dziś udaje go `Visit`) | `Visit` |
| Wizyta | Zdarzenie kliniczne z dokumentacją; może się odbyć bez rezerwacji | `Visit` | Rezerwacja, booking |
| Przypadek | Epizod leczenia złożony z kilku wizyt | brak | `Visit`, `Case` jako synonim wizyty |
| Gatunek | Pierwszy poziom słownika; od niego zależą dawki i normy | `PetType` | `Type`, `Category`, `Kind`, pole tekstowe |
| Rasa | Drugi poziom słownika, zależny od gatunku; mieszaniec to pełnoprawna wartość | brak | Część pola gatunku („Pies – labrador”) |
| Pomiar masy ciała | Masa z datą, zapisana przy wizycie; nie nadpisuje się | brak | `Patient.weight` jako jedno pole |
| Data urodzenia | Data urodzenia, opcjonalnie oznaczona jako szacunkowa | `Pet.birthDate` (bez flagi) | Wiek |
| Imię pacjenta | Etykieta opisowa: zmienna, niestabilna w pisowni, **nie** unikalna u klienta | `Pet.name` | Identyfikator, klucz wyszukiwania pacjenta |
| Numer karty pacjenta | Wewnętrzny identyfikator pacjenta | tylko techniczne `id` | Imię |
| Mikrochip / paszport | Twarde identyfikatory (chip ma 15 cyfr); nie każde zwierzę je ma | brak | Pole wymagane |
| Status pacjenta | Żyje / zmarł; zmarli zostają w systemie i nie pojawiają się przy umawianiu | brak | Usuwanie pacjenta |
| Lekarz weterynarii | Rola personelu (obok technika i recepcji) | `Vet` (wszyscy są lekarzami) | `DoctorType`, specjalizacja jako rola |
| Specjalizacja | Np. kardiologia; wpływa na grafik i cennik | `Specialty` | Rola |
| Personel | Pracownik logujący się do systemu | `Vet` (wspólna nadklasa `Person` z klientem) | Klient; `Person` jako wspólny byt z klientem |
