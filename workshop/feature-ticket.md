# QME-418 — Konfigurator Custom Blend

## Kontekst

Klienci hurtowi mogą stworzyć własną mieszankę proszkową o masie 25 kg z materiału bazowego i wybranych składników, a następnie kupić ją jak każdy inny produkt. Konfigurator jest dostępny z głównego menu kategorii bez logowania.

## Zadanie

Ta funkcja już istnieje. Przygotuj plan testów E2E z priorytetami, obejmujący konfigurator aż do potwierdzenia zamówienia. Nie implementuj testów ani nie zmieniaj aplikacji.

## Kryteria akceptacji

- **AC1 — Dodanie do koszyka:** Niezalogowany klient może wybrać materiał bazowy, dodać co najmniej jeden składnik, ustawić prawidłowe proporcje i dodać mieszankę jako jedną pozycję w koszyku, z widoczną ceną łączną. Może kontynuować zakupy lub przejść do kasy.
- **AC2 — Aktualizacja ceny na bieżąco:** Zmiana proporcji aktualizuje w podsumowaniu łączny koszt materiałów, opłatę za mieszanie i cenę łączną mieszanki bez przeładowania strony.
- **AC3 — Bezpieczeństwo:** Podsumowanie wskazuje, czy skonfigurowana mieszanka nadaje się do zastosowań spożywczych. Jeśli się nie nadaje, zawiera wskazówki dotyczące obchodzenia się z nią.
- **AC4 — Odrzucenie podczas oceny:** Jeśli ocena odrzuci kombinację, którą ekran pozwolił klientowi utworzyć, wyświetl jasny powód, nie dodawaj mieszanki do koszyka i zachowaj konfigurację, aby można ją było poprawić.
- **AC5 — Edycja mieszanki:** Gdy w koszyku jest jedna mieszanka, jej edycja przywraca wybrane opcje w konfiguratorze. Zapisanie zmian zastępuje tę pozycję, zamiast dodawać kolejną.
- **AC6 — Finalizacja zakupu:** Mieszanka pojawia się przy finalizacji zakupu i w potwierdzeniu zamówienia. Porównaj jej prezentację i cenę z podsumowaniem przy tej samej ilości i walucie, uwzględniając osobno dodatkowe opłaty i rabaty naliczane przy finalizacji zakupu.
