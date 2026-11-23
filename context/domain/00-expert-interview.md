# Przychodnia weterynaryjna – wiedza domenowa

Odpowiedzi z perspektywy menadżera przychodni weterynaryjnej.

---

## 1. Czym zajmuje się przychodnia od strony procesów? Kto jest klientem?

Przychodnia prowadzi pacjenta przez cykl wizyty, a wizyty się powtarzają:

**Umówienie → przyjęcie i triaż → badanie → diagnostyka → leczenie lub zabieg → wydanie leków → rozliczenie → przypomnienie o kolejnej wizycie.**

Do tego dochodzą procesy, o których programiści zwykle zapominają:

- **Hospitalizacja:** karta obserwacji, podawanie leków o określonych godzinach, przekazywanie zmian.
- **Szczepienia i profilaktyka:** cykle szczepień, odrobaczanie, wpisy do paszportu, czipowanie.
- **Gospodarka lekami:** magazyn, numery serii, daty ważności, obowiązkowa ewidencja. U zwierząt gospodarskich dochodzi okres karencji.
- **Dokumentacja wymagana przepisami:** historia choroby, zgody na zabieg lub znieczulenie, zgoda na eutanazję.
- **Współpraca z zewnętrznymi laboratoriami** i ze specjalistami, do których kierujemy pacjentów.

### Kto jest klientem?

Klientów są dwie role i obie trzeba wymodelować osobno:

- **Pacjentem jest zwierzę.** To ono ma historię choroby, wagę, szczepienia i alergie.
- **Klientem jest właściciel lub opiekun.** On decyduje, podpisuje zgody, płaci i odbiera SMS-y.

Relacja między nimi nie jest prosta 1:1 na zawsze:

- Jedno zwierzę może mieć kilku opiekunów, na przykład oboje małżonków.
- Zwierzę może zmienić właściciela, na przykład po adopcji ze schroniska.
- Klientem bywa firma, fundacja, hodowla albo gmina, jeśli chodzi o zwierzęta bezdomne.
- Osoba, która przyprowadza zwierzę, nie musi być osobą, która płaci.

---

## 2. Trzy kluczowe procesy, które dają realną wartość

1. **Kalendarz wizyt i przypomnienia.**
   Obłożenie gabinetów i lekarzy to nasz przychód. Automatyczne przypomnienia o szczepieniach, kontrolach i powtórzeniu badań to główne źródło powracających klientów. Jeśli system tylko zapisuje terminy, a nie generuje kolejnych wizyt, traci połowę wartości.

2. **Dokumentacja medyczna wizyty.**
   Wywiad, badanie, rozpoznanie, zalecenia i zastosowane leki muszą być zapisane szybko, w trakcie wizyty. Historia musi być czytelna dla innego lekarza za rok. To kwestia ciągłości leczenia, obowiązku prawnego i naszej obrony w razie skargi. Jeśli wpis trwa dłużej niż na papierze, lekarze nie będą go używać.

3. **Rozliczenie od wizyty do paragonu i magazynu.**
   Każda wykonana czynność i każdy podany lek powinny same trafić do rozliczenia i zdjąć towar ze stanu. Największe straty przychodni to rzeczy zrobione, ale niezaksięgowane: dodatkowa ampułka, opatrunek, „szybkie” USG. System, który to domyka, zwraca się najszybciej.

---

## 3. Pięć terminów, które programiści często nazywają źle

| Poprawny termin | Znaczenie | Jak NIE nazywać |
|---|---|---|
| **Pacjent** | Zwierzę, któremu prowadzimy dokumentację, również zwierzę gospodarskie czy egzotyczne, a czasem całe stado. | `Pet` (wyklucza zwierzęta gospodarskie i stada), `Animal` jako encja ogólna, `Customer`. Nie mieszać pacjenta z klientem w jednej tabeli. |
| **Opiekun / Klient** | Osoba lub firma odpowiedzialna za pacjenta, która podejmuje decyzje i płaci. | `User` (to pracownik logujący się do systemu), `Patient`, `Owner` jako jedyna możliwa rola (bywa współopiekun, płatnik, fundacja). |
| **Termin** a **Wizyta** | Termin to rezerwacja w kalendarzu i może się nie odbyć. Wizyta to zdarzenie kliniczne z dokumentacją. Kilka wizyt składa się na przypadek, czyli epizod leczenia. | Nazywanie rezerwacji `Visit`. Wtedy nieodbyte wizyty zaśmiecają historię choroby, a wizyta bez wcześniejszej rezerwacji, czyli nagły przypadek, „nie pasuje” do modelu. |
| **Gatunek** i **Rasa** | Dwa osobne poziomy słownika. Rasa zależy od gatunku, a mieszaniec to pełnoprawna wartość. | `Type`, `Category`, `Kind`. Nie robić z tego jednego pola tekstowego, bo pojawi się „Pies – labrador”, „labrador”, „Lab.”. Dawki leków i normy badań zależą od gatunku, więc to musi być dana słownikowa. |
| **Pomiar masy ciała** | Wartość z datą, zapisana przy wizycie. Na jej podstawie liczy się dawki. | Pole `Patient.weight`. Nadpisanie wagi niszczy historię, a lekarz musi widzieć, że kot schudł 1 kg w trzy miesiące. Tak samo z wiekiem: przechowujemy datę urodzenia z oznaczeniem „szacunkowa”, a nie wiek. |

Dodatkowo warto rozróżnić **rolę** (lekarz weterynarii, technik weterynarii, recepcja) od **specjalizacji** (np. kardiologia, dermatologia). Nie warto zakładać jednego pola `DoctorType`, bo technik nie może wykonywać części czynności, a specjalizacja wpływa na grafik i cennik.

---

## 4. Czy imię zwierzęcia identyfikuje pacjenta u jednego właściciela?

**Nie, i nigdy nie powinno.** Z praktyki recepcji:

- **Ten sam właściciel często ma dwa zwierzęta o tym samym imieniu.** Najczęściej po śmierci psa nowy dostaje to samo imię, a stary pacjent zostaje w archiwum. Zdarzają się też dwa koty „Mruczki” w jednym domu albo hodowla z kilkunastoma zwierzętami o podobnych imionach.
- **Imię się zmienia.** Zwierzę adoptowane ze schroniska często dostaje nowe imię. Hodowlane ma imię rodowodowe i inne, domowe.
- **Pisownia jest niestabilna.** Ta sama osoba raz poda „Zoë”, raz „Zoe”, a recepcjonistka wpisze „Zoi”.

### Jak rozróżniamy zwierzęta w praktyce

Recepcja szuka najpierw klienta (po telefonie lub nazwisku), potem pacjenta po imieniu. Przy zbieżnych imionach patrzy na:

- gatunek i rasę,
- płeć i kastrację,
- umaszczenie,
- datę urodzenia,
- status (żyje / zmarł),
- zdjęcie, jeśli jest.

Twardym identyfikatorem jest **numer mikrochipa** (15 cyfr) i **numer paszportu**, ale nie każde zwierzę je ma. Dlatego w systemie potrzebny jest **wewnętrzny numer karty pacjenta**.

### Co z tego wynika dla systemu

- Kluczem jest techniczne ID, a nie imię. Imienia nie robimy unikalnym nawet w obrębie jednego klienta.
- Wyszukiwanie ignoruje wielkość liter i znaki diakrytyczne, więc „zoe” znajdzie zarówno „Zoë”, jak i „Zoe”.
- Przy dodawaniu pacjenta o podobnym imieniu u tego samego klienta system pokazuje ostrzeżenie typu „Ten klient ma już pacjenta Zoe (kot, zm. 2023). Czy to nowe zwierzę?”, ale nie blokuje zapisu.
- Na listach pacjent wyświetla się z kontekstem, np. *Zoë – kot, europejski krótkowłosy, kotka kastrowana, ur. 2021*, a nie samo imię.
- Zmarli pacjenci zostają w systemie z wyraźnym statusem i domyślnie nie pojawiają się w wynikach przy umawianiu wizyty. Nikt nie chce dostać SMS-a o szczepieniu zwierzęcia, które odeszło.
