source: class-full/classes.dot + test-full/test-classes.dot + ../../../../target/classes

## Packages

| package | classes | Ca | Ce | I | Ca_test |
|---|---|---|---|---|---|
| <root> | 2 | 0 | 3 | 1.00 | 3 |
| model | 3 | 7 | 0 | 0.00 | 3 |
| owner | 11 | 0 | 3 | 1.00 | 8 |
| system | 4 | 0 | 0 | n/a | 1 |
| vet | 5 | 1 | 2 | 0.67 | 6 |

## Classes

| class | Ca | Ce | I | Ca_test | depended on by | depends on |
|---|---|---|---|---|---|---|
| model.BaseEntity | 4 | 0 | 0.00 | 2 | PetClinicRuntimeHints model.NamedEntity model.Person owner.Visit |  |
| model.NamedEntity | 4 | 1 | 0.20 | 0 | owner.Pet owner.PetType vet.Specialty vet.Vet | model.BaseEntity |
| model.Person | 3 | 1 | 0.25 | 1 | PetClinicRuntimeHints owner.Owner vet.Vet | model.BaseEntity |
| owner.Owner | 4 | 3 | 0.43 | 6 | owner.OwnerController owner.OwnerRepository owner.PetController owner.VisitController | model.Person owner.Pet owner.Visit |
| owner.OwnerController | 0 | 2 | 1.00 | 0 |  | owner.Owner owner.OwnerRepository |
| owner.OwnerRepository | 3 | 1 | 0.25 | 5 | owner.OwnerController owner.PetController owner.VisitController | owner.Owner |
| owner.Pet | 4 | 3 | 0.43 | 7 | owner.Owner owner.PetController owner.PetValidator owner.VisitController | model.NamedEntity owner.PetType owner.Visit |
| owner.PetController | 0 | 6 | 1.00 | 0 |  | owner.Owner owner.OwnerRepository owner.Pet owner.PetType owner.PetTypeRepository owner.PetValidator |
| owner.PetType | 5 | 1 | 0.17 | 5 | owner.Pet owner.PetController owner.PetTypeFormatter owner.PetTypeRepository owner.PetValidator | model.NamedEntity |
| owner.PetTypeFormatter | 0 | 2 | 1.00 | 1 |  | owner.PetType owner.PetTypeRepository |
| owner.PetTypeRepository | 2 | 1 | 0.33 | 3 | owner.PetController owner.PetTypeFormatter | owner.PetType |
| owner.PetValidator | 1 | 2 | 0.67 | 1 | owner.PetController | owner.Pet owner.PetType |
| owner.Visit | 3 | 1 | 0.25 | 2 | owner.Owner owner.Pet owner.VisitController | model.BaseEntity |
| owner.VisitController | 0 | 4 | 1.00 | 0 |  | owner.Owner owner.OwnerRepository owner.Pet owner.Visit |
| PetClinicApplication | 0 | 0 | n/a | 3 |  |  |
| PetClinicRuntimeHints | 0 | 3 | 1.00 | 0 |  | model.BaseEntity model.Person vet.Vet |
| system.CacheConfiguration | 0 | 0 | n/a | 0 |  |  |
| system.CrashController | 0 | 0 | n/a | 1 |  |  |
| system.WebConfiguration | 0 | 0 | n/a | 0 |  |  |
| system.WelcomeController | 0 | 0 | n/a | 0 |  |  |
| vet.Specialty | 1 | 1 | 0.50 | 2 | vet.Vet | model.NamedEntity |
| vet.Vet | 4 | 3 | 0.43 | 3 | PetClinicRuntimeHints vet.VetController vet.VetRepository vet.Vets | model.NamedEntity model.Person vet.Specialty |
| vet.VetController | 0 | 3 | 1.00 | 0 |  | vet.Vet vet.VetRepository vet.Vets |
| vet.VetRepository | 1 | 1 | 0.50 | 5 | vet.VetController | vet.Vet |
| vet.Vets | 1 | 1 | 0.50 | 0 | vet.VetController | vet.Vet |
