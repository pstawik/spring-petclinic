---
change_id: pet-duplicate-name-analysis
title: Analiza odrzucania zdublowanego imienia zwierzęcia u właściciela
status: preparing
created: 2026-11-23
updated: 2026-11-23
archived_at: null
---

## Notes

Zbadać, jak zapis zwierzęcia z imieniem już używanym u tego samego właściciela (dodawanie i edycja) kończy się błędem w formularzu, zaczynając od owner/PetController.java (isDuplicatePetNameViolation), bo mapa wskazuje ten obszar jako strefę ryzyka 3: reguła domenowa rozpoznaje naruszenie po napisie unique_owner_pet_name w komunikacie bazy, ograniczenie ma nazwę tylko w 2 z 3 schema.sql, a regułę zna jedna osoba.
