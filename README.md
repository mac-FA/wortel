# Wortel

Deutscher Wordle-Klon – reines HTML/CSS/JavaScript, keine Abhängigkeiten, offline spielbar (PWA).

- **Täglich:** ein Wort pro Tag (Nr. 1 = 7. Oktober 2026), für alle gleich, Spielstand bleibt beim Neuladen erhalten.
- **Endlos:** beliebig viele Runden mit Zufallswörtern, eigene Statistik.
- QWERTZ-Tastatur mit Ä/Ö/Ü, ß wird als SS eingegeben.
- Schwerer Modus, dunkles Design, Hoher Kontrast (Farbsehschwäche), optional unbekannte Wörter erlauben.
- Teilen-Knopf kopiert das Farbraster in die Zwischenablage.

## Starten

```
npx http-server Wortel -p 8119 -c-1
```

## Wortlisten

`js/words.js` wird erzeugt, nicht von Hand bearbeitet:

1. `tools/expand-hunspell.js` expandiert das deutsche Hunspell-Wörterbuch (igerman98/frami, aus LibreOffice) zu allen Wortformen mit 5 Buchstaben → `tools/hunspell5.txt`.
2. `tools/loesungen-roh.txt` enthält die handverlesenen Lösungswörter.
3. `node tools/build-words.js` gleicht beides ab (nur Lösungen, die im Wörterbuch stehen) und schreibt `js/words.js`.

Die erlaubten Wörter stammen aus igerman98 (© Björn Jacke u. a., GPLv2/GPLv3, siehe `tools/COPYING-igerman98-GPLv3.txt`).

Live: https://mac-fa.github.io/wortel/
