(() => {
  'use strict';

  const LAENGE = 5;
  const VERSUCHE = 6;
  const START = new Date(2026, 9, 7); // Wortel Nr. 1 = 7. Oktober 2026
  const FLIP_MS = 300;
  const LOB = ['Genial!', 'Großartig!', 'Beeindruckend!', 'Sehr gut!', 'Gut gemacht!', 'Puh, knapp!'];
  const RANG = { falsch: 1, vorhanden: 2, richtig: 3 };

  const LOESUNGEN = window.WORTEL_LOESUNGEN;
  const GUELTIG = new Set([...LOESUNGEN, ...window.WORTEL_ERLAUBT]);

  // Feste, aber nicht alphabetische Reihenfolge der Tageswörter
  const TAGESFOLGE = (() => {
    let s = 0x5f3759df;
    const zufall = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const a = LOESUNGEN.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(zufall() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  })();

  // ---------- Speicher ----------
  const speicher = {
    lies(k, std) {
      try { const v = localStorage.getItem('wortel.' + k); return v ? JSON.parse(v) : std; }
      catch { return std; }
    },
    schreib(k, v) {
      try { localStorage.setItem('wortel.' + k, JSON.stringify(v)); } catch { /* privat */ }
    }
  };

  const einst = Object.assign(
    { schwer: false, dunkel: null, kontrast: false, locker: false },
    speicher.lies('einstellungen', {})
  );
  let modus = speicher.lies('modus', 'taeglich');
  let spiel = null;
  let eingabeGesperrt = false;
  let unbekanntBestaetigen = null;

  const leereStat = () => ({ gespielt: 0, gewonnen: 0, serie: 0, beste: 0, verteilung: [0, 0, 0, 0, 0, 0], letzteNr: null });
  const statistik = {
    taeglich: Object.assign(leereStat(), speicher.lies('stat.taeglich', {})),
    endlos: Object.assign(leereStat(), speicher.lies('stat.endlos', {}))
  };

  // ---------- Hilfsfunktionen ----------
  const $ = id => document.getElementById(id);
  const brettEl = $('brett');
  const tastaturEl = $('tastatur');

  function heutigeNr() {
    const h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.round((h - START) / 864e5) + 1;
  }
  function tageswort(nr) {
    const n = TAGESFOLGE.length;
    return TAGESFOLGE[(((nr - 1) % n) + n) % n];
  }
  function zufallswort() {
    let w;
    do { w = LOESUNGEN[Math.floor(Math.random() * LOESUNGEN.length)]; }
    while (spiel && w === spiel.loesung);
    return w;
  }

  function bewerte(rate, loesung) {
    const erg = Array(LAENGE).fill('falsch');
    const rest = {};
    for (let i = 0; i < LAENGE; i++) {
      if (rate[i] === loesung[i]) erg[i] = 'richtig';
      else rest[loesung[i]] = (rest[loesung[i]] || 0) + 1;
    }
    for (let i = 0; i < LAENGE; i++) {
      if (erg[i] !== 'richtig' && rest[rate[i]] > 0) {
        erg[i] = 'vorhanden';
        rest[rate[i]]--;
      }
    }
    return erg;
  }

  // Liefert eine Fehlermeldung, wenn der Versuch die Regeln des schweren Modus verletzt
  function pruefeSchwer(rate) {
    for (const v of spiel.versuche) {
      const erg = bewerte(v, spiel.loesung);
      for (let i = 0; i < LAENGE; i++) {
        if (erg[i] === 'richtig' && rate[i] !== v[i]) return `${i + 1}. Buchstabe muss ${v[i]} sein`;
      }
      const noetig = {};
      for (let i = 0; i < LAENGE; i++) if (erg[i] !== 'falsch') noetig[v[i]] = (noetig[v[i]] || 0) + 1;
      for (const b in noetig) {
        const da = [...rate].filter(x => x === b).length;
        if (da < noetig[b]) return `Wort muss ${b} enthalten`;
      }
    }
    return null;
  }

  // ---------- Spielstand ----------
  function neuesSpiel(m, nr) {
    return {
      modus: m,
      nr: m === 'taeglich' ? nr : (statistik.endlos.gespielt + 1),
      loesung: m === 'taeglich' ? tageswort(nr) : zufallswort(),
      versuche: [],
      fertig: false,
      gewonnen: false,
      schwer: einst.schwer
    };
  }
  function ladeSpiel() {
    if (modus === 'taeglich') {
      const nr = heutigeNr();
      const s = speicher.lies('spiel.taeglich', null);
      spiel = (s && s.nr === nr && s.loesung === tageswort(nr)) ? s : neuesSpiel('taeglich', nr);
      const st = statistik.taeglich;
      if (st.letzteNr !== null && st.letzteNr < nr - 1 && st.serie) { st.serie = 0; speichereStat(); }
    } else {
      const s = speicher.lies('spiel.endlos', null);
      spiel = (s && LOESUNGEN.includes(s.loesung) && !s.fertig) ? s : neuesSpiel('endlos');
    }
    spiel.aktuell = '';
    speichereSpiel();
  }
  function speichereSpiel() {
    const { aktuell, ...rest } = spiel;
    speicher.schreib('spiel.' + spiel.modus, rest);
  }
  function speichereStat() {
    speicher.schreib('stat.taeglich', statistik.taeglich);
    speicher.schreib('stat.endlos', statistik.endlos);
  }

  // ---------- Darstellung ----------
  function baueBrett() {
    brettEl.innerHTML = '';
    for (let r = 0; r < VERSUCHE; r++) {
      const z = document.createElement('div');
      z.className = 'zeile';
      for (let c = 0; c < LAENGE; c++) {
        const f = document.createElement('div');
        f.className = 'feld';
        z.appendChild(f);
      }
      brettEl.appendChild(z);
    }
    spiel.versuche.forEach((v, r) => {
      const erg = bewerte(v, spiel.loesung);
      const felder = brettEl.children[r].children;
      for (let c = 0; c < LAENGE; c++) {
        felder[c].textContent = v[c];
        felder[c].className = 'feld ' + erg[c];
      }
    });
    zeigeAktuelleZeile();
  }

  function zeigeAktuelleZeile() {
    const r = spiel.versuche.length;
    if (r >= VERSUCHE || spiel.fertig) return;
    const felder = brettEl.children[r].children;
    for (let c = 0; c < LAENGE; c++) {
      const b = spiel.aktuell[c] || '';
      felder[c].textContent = b;
      felder[c].classList.toggle('gefuellt', !!b);
    }
  }

  const REIHEN = ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', '+YXCVBNM-'];
  const ZURUECK_SVG = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M22 3H7c-.7 0-1.2.3-1.6.9L0 12l5.4 8.1c.4.5.9.9 1.6.9h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7.1L2.4 12l4.7-7H22v14zm-11.6-2L14 13.4l3.6 3.6 1.4-1.4-3.6-3.6L19 8.4 17.6 7 14 10.6 10.4 7 9 8.4l3.6 3.6L9 15.6z"/></svg>';
  function baueTastatur() {
    tastaturEl.innerHTML = '';
    for (const reihe of REIHEN) {
      const div = document.createElement('div');
      div.className = 'tastenreihe';
      for (const z of reihe) {
        const t = document.createElement('button');
        t.className = 'taste';
        t.type = 'button';
        if (z === '+') { t.textContent = 'Enter'; t.dataset.taste = 'ENTER'; t.classList.add('breit'); }
        else if (z === '-') { t.innerHTML = ZURUECK_SVG; t.dataset.taste = 'ZURUECK'; t.classList.add('breit'); t.setAttribute('aria-label', 'Löschen'); }
        else { t.textContent = z; t.dataset.taste = z; }
        div.appendChild(t);
      }
      tastaturEl.appendChild(div);
    }
    faerbeTastatur();
  }
  function faerbeTastatur() {
    const zustand = {};
    for (const v of spiel.versuche) {
      bewerte(v, spiel.loesung).forEach((e, i) => {
        if (!zustand[v[i]] || RANG[e] > RANG[zustand[v[i]]]) zustand[v[i]] = e;
      });
    }
    tastaturEl.querySelectorAll('.taste').forEach(t => {
      t.classList.remove('richtig', 'vorhanden', 'falsch');
      const z = zustand[t.dataset.taste];
      if (z) t.classList.add(z);
    });
  }

  function zeigeInfo() {
    const btn = $('btn-modus');
    btn.textContent = modus === 'taeglich' ? 'Täglich' : 'Endlos';
    btn.classList.toggle('endlos', modus === 'endlos');
    const teile = [modus === 'taeglich' ? `Wort des Tages Nr. ${spiel.nr}` : `Endlos-Modus · Runde ${spiel.nr}`];
    if (spiel.schwer) teile.push('Schwerer Modus');
    $('info-zeile').textContent = teile.join(' · ');
  }

  function toast(text, dauer = 1500) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    $('toasts').prepend(t);
    if (dauer > 0) {
      setTimeout(() => { t.classList.add('weg'); setTimeout(() => t.remove(), 300); }, dauer);
    }
    return t;
  }

  function wackeln() {
    const z = brettEl.children[spiel.versuche.length];
    z.classList.remove('wackeln');
    void z.offsetWidth;
    z.classList.add('wackeln');
    setTimeout(() => z.classList.remove('wackeln'), 500);
  }

  // ---------- Eingabe ----------
  function taste(k) {
    if (eingabeGesperrt || spiel.fertig || offenerDialog()) return;
    if (k === 'ENTER') return absenden();
    if (k === 'ZURUECK') {
      if (spiel.aktuell.length) { spiel.aktuell = spiel.aktuell.slice(0, -1); unbekanntBestaetigen = null; zeigeAktuelleZeile(); }
      return;
    }
    if (k === 'ß') { taste('S'); taste('S'); return; }
    if (/^[A-ZÄÖÜ]$/.test(k) && spiel.aktuell.length < LAENGE) {
      spiel.aktuell += k;
      unbekanntBestaetigen = null;
      zeigeAktuelleZeile();
    }
  }

  function absenden() {
    const rate = spiel.aktuell;
    if (rate.length < LAENGE) { wackeln(); toast('Zu wenig Buchstaben'); return; }
    if (!GUELTIG.has(rate)) {
      if (einst.locker && unbekanntBestaetigen === rate) {
        unbekanntBestaetigen = null;
      } else {
        wackeln();
        if (einst.locker) { unbekanntBestaetigen = rate; toast('Nicht in der Wortliste – nochmal Enter zum Bestätigen', 2200); }
        else toast('Nicht in der Wortliste');
        return;
      }
    }
    if (spiel.schwer) {
      const fehler = pruefeSchwer(rate);
      if (fehler) { wackeln(); toast(fehler); return; }
    }
    spiel.versuche.push(rate);
    spiel.aktuell = '';
    const r = spiel.versuche.length - 1;
    const gewonnen = rate === spiel.loesung;
    if (gewonnen || spiel.versuche.length === VERSUCHE) {
      spiel.fertig = true;
      spiel.gewonnen = gewonnen;
      bucheStatistik();
    }
    speichereSpiel();
    aufdecken(r, () => {
      faerbeTastatur();
      if (!spiel.fertig) return;
      if (gewonnen) {
        toast(LOB[r]);
        huepfen(r);
        setTimeout(() => oeffneStatistik(), 1900);
      } else {
        toast(spiel.loesung, 2600);
        setTimeout(() => oeffneStatistik(), 1800);
      }
    });
  }

  function aufdecken(r, fertig) {
    eingabeGesperrt = true;
    const erg = bewerte(spiel.versuche[r], spiel.loesung);
    const felder = brettEl.children[r].children;
    for (let c = 0; c < LAENGE; c++) {
      setTimeout(() => {
        felder[c].classList.add('drehen');
        setTimeout(() => {
          felder[c].className = 'feld drehen-zurueck ' + erg[c];
        }, 250);
      }, c * FLIP_MS);
    }
    setTimeout(() => {
      for (const f of felder) f.classList.remove('drehen-zurueck');
      eingabeGesperrt = false;
      fertig();
    }, (LAENGE - 1) * FLIP_MS + 520);
  }

  function huepfen(r) {
    const felder = brettEl.children[r].children;
    for (let c = 0; c < LAENGE; c++) {
      setTimeout(() => felder[c].classList.add('huepfen'), c * 100);
    }
  }

  function bucheStatistik() {
    const st = statistik[spiel.modus];
    st.gespielt++;
    if (spiel.gewonnen) {
      st.gewonnen++;
      st.verteilung[spiel.versuche.length - 1]++;
      const fortlaufend = spiel.modus === 'endlos' || st.letzteNr === null || st.letzteNr === spiel.nr - 1;
      st.serie = fortlaufend ? st.serie + 1 : 1;
      st.beste = Math.max(st.beste, st.serie);
    } else {
      st.serie = 0;
    }
    st.letzteNr = spiel.nr;
    speichereStat();
  }

  // ---------- Dialoge ----------
  function offenerDialog() {
    return document.querySelector('.dialog:not([hidden])');
  }
  function oeffne(id) {
    document.querySelectorAll('.dialog').forEach(d => { d.hidden = d.id !== id; });
  }
  function schliesse() {
    document.querySelectorAll('.dialog').forEach(d => { d.hidden = true; });
    document.activeElement && document.activeElement.blur();
  }

  function oeffneStatistik() {
    const st = statistik[modus];
    $('stat-modus').textContent = modus === 'taeglich' ? '· Täglich' : '· Endlos';
    const quote = st.gespielt ? Math.round(st.gewonnen / st.gespielt * 100) : 0;
    $('zahlen').innerHTML = [
      [st.gespielt, 'Gespielt'], [quote, 'Gewonnen %'], [st.serie, 'Aktuelle Serie'], [st.beste, 'Beste Serie']
    ].map(([z, t]) => `<div class="zahl"><b>${z}</b><span>${t}</span></div>`).join('');

    const max = Math.max(1, ...st.verteilung);
    const aktuell = spiel.fertig && spiel.gewonnen ? spiel.versuche.length - 1 : -1;
    $('verteilung').innerHTML = st.verteilung.map((n, i) =>
      `<div class="balken-zeile"><span>${i + 1}</span><div class="balken${i === aktuell ? ' aktuell' : ''}" style="width:${Math.max(7, n / max * 100)}%">${n}</div></div>`
    ).join('');

    const ergEl = $('ergebnis');
    if (spiel.fertig) {
      const titel = spiel.gewonnen ? LOB[spiel.versuche.length - 1] : 'Schade!';
      const unter = spiel.gewonnen
        ? `Gelöst in ${spiel.versuche.length} von ${VERSUCHE} Versuchen.`
        : 'Das gesuchte Wort war:';
      const kacheln = [...spiel.loesung].map(b => `<span>${b}</span>`).join('');
      const duden = 'https://www.duden.de/suchen/dudenonline/' + encodeURIComponent(spiel.loesung.toLowerCase());
      ergEl.innerHTML = `<div class="titel">${titel}</div><div>${unter}</div><div class="loesung">${kacheln}</div><div><a href="${duden}" target="_blank" rel="noopener">Im Duden nachschlagen</a></div>`;
      ergEl.hidden = false;
      $('aktionen').hidden = false;
      $('countdown-box').hidden = modus !== 'taeglich';
      $('btn-neu').textContent = modus === 'taeglich' ? 'Endlos spielen' : 'Nächstes Wort';
    } else {
      ergEl.hidden = true;
      $('aktionen').hidden = true;
    }
    oeffne('dlg-statistik');
  }

  function teilen() {
    const kontrast = einst.kontrast;
    const dunkel = document.documentElement.classList.contains('dunkel');
    const symbol = {
      richtig: kontrast ? '\u{1F7E7}' : '\u{1F7E9}',
      vorhanden: kontrast ? '\u{1F7E6}' : '\u{1F7E8}',
      falsch: dunkel ? '⬛' : '⬜'
    };
    const ergebnis = spiel.gewonnen ? spiel.versuche.length : 'X';
    const kopf = spiel.modus === 'taeglich' ? `Wortel #${spiel.nr}` : 'Wortel (Endlos)';
    const raster = spiel.versuche.map(v => bewerte(v, spiel.loesung).map(e => symbol[e]).join('')).join('\n');
    const text = `${kopf} ${ergebnis}/${VERSUCHE}${spiel.schwer ? '*' : ''}\n\n${raster}`;
    const mobil = matchMedia('(pointer: coarse)').matches;
    if (mobil && navigator.share) {
      navigator.share({ text }).catch(() => {});
      return;
    }
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast('In die Zwischenablage kopiert'))
      .catch(() => toast('Kopieren nicht möglich'));
  }

  function wechsleModus(neu) {
    if (eingabeGesperrt) return;
    modus = neu;
    speicher.schreib('modus', modus);
    ladeSpiel();
    baueBrett();
    faerbeTastatur();
    zeigeInfo();
  }

  function neuesEndlosSpiel() {
    if (modus === 'endlos' && spiel.fertig) speicher.schreib('spiel.endlos', null);
    schliesse();
    wechsleModus('endlos');
  }

  // ---------- Einstellungen ----------
  function wendeDesignAn() {
    const sysDunkel = matchMedia('(prefers-color-scheme: dark)').matches;
    const dunkel = einst.dunkel === null ? sysDunkel : einst.dunkel;
    document.documentElement.classList.toggle('dunkel', dunkel);
    document.documentElement.classList.toggle('kontrast', einst.kontrast);
    document.querySelector('meta[name=theme-color]').content = dunkel ? '#121213' : '#ffffff';
    $('opt-dunkel').checked = dunkel;
  }
  function initEinstellungen() {
    $('opt-schwer').checked = einst.schwer;
    $('opt-kontrast').checked = einst.kontrast;
    $('opt-locker').checked = einst.locker;
    $('wortzahl').textContent = `${LOESUNGEN.length} Lösungswörter · ${GUELTIG.size.toLocaleString('de-DE')} erlaubte Wörter`;

    $('opt-schwer').addEventListener('change', e => {
      const laeuft = spiel.versuche.length > 0 && !spiel.fertig;
      if (laeuft) {
        e.target.checked = einst.schwer;
        toast('Nur zu Beginn einer Runde änderbar', 2000);
        return;
      }
      einst.schwer = e.target.checked;
      if (!spiel.fertig) { spiel.schwer = einst.schwer; speichereSpiel(); }
      speicher.schreib('einstellungen', einst);
      zeigeInfo();
    });
    $('opt-dunkel').addEventListener('change', e => {
      einst.dunkel = e.target.checked;
      speicher.schreib('einstellungen', einst);
      wendeDesignAn();
    });
    $('opt-kontrast').addEventListener('change', e => {
      einst.kontrast = e.target.checked;
      speicher.schreib('einstellungen', einst);
      wendeDesignAn();
    });
    $('opt-locker').addEventListener('change', e => {
      einst.locker = e.target.checked;
      speicher.schreib('einstellungen', einst);
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', wendeDesignAn);
  }

  function baueBeispiele() {
    document.querySelectorAll('.beispiel').forEach(b => {
      const zust = b.dataset.zust.split(',');
      b.innerHTML = [...b.dataset.wort].map((z, i) =>
        `<div class="feld ${zust[i] || 'gefuellt'}">${z}</div>`).join('');
    });
  }

  // ---------- Countdown ----------
  function tick() {
    const jetzt = new Date();
    const morgen = new Date(jetzt); morgen.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((morgen - jetzt) / 1000));
    const p = n => String(n).padStart(2, '0');
    $('countdown').textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
    if (modus === 'taeglich' && spiel.nr !== heutigeNr() && !eingabeGesperrt) {
      schliesse();
      wechsleModus('taeglich');
      toast('Ein neues Wort des Tages ist da!', 2500);
    }
  }

  // ---------- Start ----------
  function start() {
    wendeDesignAn();
    ladeSpiel();
    baueBrett();
    baueTastatur();
    zeigeInfo();
    initEinstellungen();
    baueBeispiele();

    tastaturEl.addEventListener('click', e => {
      const t = e.target.closest('.taste');
      if (t) { taste(t.dataset.taste); t.blur(); }
    });
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { schliesse(); return; }
      if (offenerDialog()) return;
      if (e.key === 'Enter') { e.preventDefault(); taste('ENTER'); }
      else if (e.key === 'Backspace') taste('ZURUECK');
      else if (e.key === 'ß') taste('ß');
      else if (/^[a-zäöü]$/i.test(e.key)) taste(e.key.toUpperCase());
    });

    $('btn-hilfe').addEventListener('click', () => oeffne('dlg-hilfe'));
    $('btn-statistik').addEventListener('click', oeffneStatistik);
    $('btn-einstellungen').addEventListener('click', () => oeffne('dlg-einstellungen'));
    $('btn-modus').addEventListener('click', () => {
      wechsleModus(modus === 'taeglich' ? 'endlos' : 'taeglich');
      toast(modus === 'taeglich' ? 'Wort des Tages' : 'Endlos-Modus');
    });
    $('btn-teilen').addEventListener('click', teilen);
    $('btn-neu').addEventListener('click', neuesEndlosSpiel);
    document.querySelectorAll('.dialog').forEach(d => {
      d.addEventListener('click', e => {
        if (e.target === d || e.target.closest('[data-schliessen]')) schliesse();
      });
    });

    if (!speicher.lies('gesehen', false)) {
      speicher.schreib('gesehen', true);
      oeffne('dlg-hilfe');
    } else if (spiel.fertig) {
      setTimeout(oeffneStatistik, 300);
    }

    tick();
    setInterval(tick, 1000);

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  start();
})();
