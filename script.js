/* Six Iconic Lives: shared JavaScript.
   data.js defines window.SITE (figures, quiz questions, clues). This file adds the menu animation, the scroll bar,
   the glossary filter, the quiz, the games and the one-question check on each figure page. */
(function () {
  "use strict";

  var D = window.SITE || { figures: [], questions: [], memFacts: {}, clues: {} };
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function $(sel, root) { return (root || document).querySelector(sel); }
  function byId(id) { return document.getElementById(id); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function fig(id) { return D.figures.filter(function (f) { return f.id === id; })[0]; }
  var ids = D.figures.map(function (f) { return f.id; });

  // ---------- Menu: pop the tapped link, fade the page out, then go ----------
  var nav = $(".nav");
  if (nav) {
    nav.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var url;
      try { url = new URL(a.href, window.location.href); } catch (err) { return; }
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.hash)) return;
      e.preventDefault();
      a.classList.add("clicked");
      document.body.classList.add("leaving");
      setTimeout(function () { window.location.href = a.href; }, reduce ? 0 : 280);
    });
  }
  window.addEventListener("pageshow", function () {
    document.body.classList.remove("leaving");
    var c = document.querySelector(".nav a.clicked");
    if (c) c.classList.remove("clicked");
  });

  // ---------- Scroll progress bar ----------
  var bar = $(".progress i"), ticking = false;
  function updateProgress() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? window.scrollY / h : 0;
    if (bar) bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, p)) + ")";
    ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); } }, { passive: true });
  updateProgress();

  // ---------- Glossary filter ----------
  var filter = byId("gloss-filter");
  if (filter) {
    var cards = Array.prototype.slice.call(document.querySelectorAll("#gloss .term"));
    var empty = byId("gloss-empty");
    filter.addEventListener("input", function () {
      var q = filter.value.trim().toLowerCase(), shown = 0;
      cards.forEach(function (c) {
        var match = !q || c.getAttribute("data-search").indexOf(q) !== -1;
        c.hidden = !match;
        if (match) shown++;
      });
      empty.hidden = shown !== 0;
    });
  }

  // ---------- Quiz questions (quiz page and the check on each figure page) ----------
  function questionHtml(item, i, showNumber) {
    var h = '<p class="prompt">' + (showNumber ? '<span class="n">Q' + (i + 1) + "</span>" : "") + item.q + '</p><div class="opts">';
    item.o.forEach(function (t, j) { h += '<button type="button" class="opt" data-q="' + i + '" data-o="' + j + '">' + t + "</button>"; });
    return h + '</div><p class="explain" hidden></p>';
  }
  function answer(btn, item) {
    var box = btn.closest(".q");
    var oi = +btn.getAttribute("data-o");
    Array.prototype.forEach.call(box.querySelectorAll(".opt"), function (b, idx) {
      b.disabled = true;
      if (idx === item.a) b.classList.add("right");
      else if (idx === oi) b.classList.add("wrong");
    });
    var ex = box.querySelector(".explain");
    ex.hidden = false;
    ex.textContent = (oi === item.a ? "Correct. " : "Not quite. ") + item.e;
    return oi === item.a;
  }

  var quiz = byId("quiz");
  if (quiz) {
    var scoreEl = byId("score"), score = 0, answered = 0, total = D.questions.length;
    var buildQuiz = function () {
      score = 0; answered = 0;
      quiz.innerHTML = "";
      D.questions.forEach(function (item, i) {
        var box = document.createElement("div");
        box.className = "q t-" + item.f;
        box.innerHTML = questionHtml(item, i, true);
        quiz.appendChild(box);
      });
      updateScore();
    };
    var updateScore = function () {
      scoreEl.textContent = score + " of " + total + " answered correctly" + (answered === total ? ". All questions done." : "");
    };
    quiz.addEventListener("click", function (e) {
      var btn = e.target.closest(".opt");
      if (!btn || btn.disabled) return;
      var item = D.questions[+btn.getAttribute("data-q")];
      answered++;
      if (answer(btn, item)) score++;
      updateScore();
    });
    byId("reset").addEventListener("click", buildQuiz);
    buildQuiz();
  }

  var check = byId("check");
  if (check) {
    var fid = check.getAttribute("data-fig");
    var item = D.questions.filter(function (q) { return q.f === fid; })[0];
    if (item) {
      check.innerHTML = questionHtml(item, 0, false);
      check.addEventListener("click", function (e) {
        var btn = e.target.closest(".opt");
        if (btn && !btn.disabled) answer(btn, item);
      });
    }
  }

  // ---------- Games ----------
  var gTabs = byId("game-tabs");
  if (gTabs) {
    var panels = { memory: byId("g-memory"), order: byId("g-order"), who: byId("g-who") };
    gTabs.addEventListener("click", function (e) {
      var t = e.target.closest(".gtab");
      if (!t) return;
      Array.prototype.forEach.call(gTabs.children, function (b) { b.setAttribute("aria-selected", b === t ? "true" : "false"); });
      Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== t.getAttribute("data-g"); });
    });

    // Game 1: memory match
    (function () {
      var el = panels.memory, cards, first, lock, moves, pairs;
      function setMsg(t) { byId("mem-msg").textContent = t; }
      function stats() { byId("mem-stats").textContent = "Moves " + moves + " · Pairs " + pairs + " of " + D.figures.length; }
      function paint(i) {
        var b = el.querySelector('[data-i="' + i + '"]');
        b.classList.toggle("open", !!cards[i].open);
        b.classList.toggle("done", !!cards[i].done);
      }
      function start() {
        cards = [];
        D.figures.forEach(function (f) {
          cards.push({ id: f.id, kind: "name", text: f.name });
          cards.push({ id: f.id, kind: "fact", text: D.memFacts[f.id] });
        });
        cards = shuffle(cards); first = null; lock = false; moves = 0; pairs = 0;
        el.innerHTML = '<div class="game-bar"><p id="mem-msg" aria-live="polite">Match each person to what they are known for.</p><span class="mono" id="mem-stats"></span></div>' +
          '<div class="memory">' + cards.map(function (c, i) {
            return '<button type="button" class="mcard t-' + c.id + '" data-i="' + i + '"><span class="back"><span class="sr">Face-down card</span></span><span class="face ' + c.kind + '">' + c.text + "</span></button>";
          }).join("") + '</div><div class="game-actions"><button type="button" class="gbtn" id="mem-restart">New game</button></div>';
        stats();
      }
      function flip(i) {
        var c = cards[i];
        if (lock || c.open || c.done) return;
        c.open = true; paint(i);
        if (first === null) { first = i; return; }
        moves++;
        var a = first, other = cards[a];
        first = null;
        if (other.id === c.id) {
          other.open = false; c.open = false; other.done = true; c.done = true;
          paint(a); paint(i); pairs++; stats();
          setMsg(pairs === D.figures.length ? "All matched in " + moves + " moves." : "A match.");
        } else {
          lock = true; stats(); setMsg("Not a match.");
          setTimeout(function () { other.open = false; c.open = false; paint(a); paint(i); lock = false; }, 900);
        }
      }
      el.addEventListener("click", function (e) {
        var b = e.target.closest(".mcard");
        if (b) { flip(+b.getAttribute("data-i")); return; }
        if (e.target.id === "mem-restart") start();
      });
      start();
    })();

    // Game 2: birth order
    (function () {
      var el = panels.order, pool, chosen, done;
      var sorted = D.figures.slice().sort(function (a, b) { return a.born - b.born; }).map(function (f) { return f.id; });
      var n = D.figures.length;
      function start() { pool = shuffle(ids); chosen = []; done = false; draw(); }
      function draw() {
        var score = 0, slots = "";
        for (var i = 0; i < n; i++) {
          var id = chosen[i], cls = "", txt = '<span class="empty">Tap a name below</span>';
          if (id) {
            var f = fig(id);
            txt = "<strong>" + f.name + "</strong>";
            if (done) {
              var ok = sorted[i] === id;
              if (ok) score++;
              cls = ok ? " right" : " wrong";
              txt += '<span class="mono">born ' + f.born + "</span>";
            }
          }
          slots += '<li class="slot' + cls + '"><span class="num">' + (i + 1) + "</span><span>" + txt + "</span></li>";
        }
        var chips = pool.filter(function (id) { return chosen.indexOf(id) === -1; }).map(function (id) {
          return '<button type="button" class="chip t-' + id + '" data-id="' + id + '">' + fig(id).name + "</button>";
        }).join("");
        el.innerHTML = '<div class="game-bar"><p aria-live="polite">' + (done ? "You placed " + score + " of " + n + " correctly." : "Tap the people in order of birth, earliest first.") + "</p></div>" +
          '<ol class="slots">' + slots + "</ol>" + (chips ? '<div class="chips">' + chips + "</div>" : "") +
          '<div class="game-actions"><button type="button" class="gbtn alt" id="ord-undo"' + (chosen.length && !done ? "" : " disabled") + '>Undo</button><button type="button" class="gbtn" id="ord-reset">' + (done ? "Play again" : "Shuffle") + "</button></div>";
      }
      el.addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (chip && !done) { chosen.push(chip.getAttribute("data-id")); if (chosen.length === n) done = true; draw(); return; }
        if (e.target.id === "ord-undo" && chosen.length && !done) { chosen.pop(); draw(); return; }
        if (e.target.id === "ord-reset") start();
      });
      start();
    })();

    // Game 3: who am I
    (function () {
      var el = panels.who, order, r, c, score, picked, n = D.figures.length;
      function start() { order = shuffle(ids); r = 0; c = 0; score = 0; picked = null; draw(); }
      function draw() {
        if (r >= n) {
          el.innerHTML = '<div class="game-bar"><p aria-live="polite">Finished. You scored ' + score + " of " + (n * 3) + '.</p></div><div class="game-actions"><button type="button" class="gbtn" id="who-restart">Play again</button></div>';
          return;
        }
        var id = order[r], f = fig(id), answered = picked !== null, ok = picked === id;
        var list = D.clues[id].slice(0, c + 1).map(function (t, k) { return '<li data-n="' + (k + 1) + '">' + t + "</li>"; }).join("");
        var btns = D.figures.map(function (g) {
          var cls = "chip t-" + g.id;
          if (answered) { if (g.id === id) cls += " right"; else if (g.id === picked) cls += " wrong"; }
          return '<button type="button" class="' + cls + '" data-id="' + g.id + '"' + (answered ? " disabled" : "") + ">" + g.name + "</button>";
        }).join("");
        var result = "";
        if (answered) {
          var pts = ok ? 3 - c : 0;
          result = '<p class="who-result" aria-live="polite">' + (ok ? "Correct. +" + pts + (pts === 1 ? " point." : " points.") : "Not quite. It was " + f.name + ".") + " " + f.known + ".</p>";
        }
        el.innerHTML = '<div class="game-bar"><p>Round ' + (r + 1) + " of " + n + '</p><span class="mono">Score ' + score + " of " + (n * 3) + "</span></div>" +
          '<ol class="clues">' + list + "</ol>" + '<div class="chips">' + btns + "</div>" + result +
          '<div class="game-actions">' + (answered ? '<button type="button" class="gbtn" id="who-next">' + (r === n - 1 ? "See score" : "Next round") + "</button>" : '<button type="button" class="gbtn alt" id="who-clue"' + (c >= 2 ? " disabled" : "") + ">Another clue</button>") + "</div>" +
          '<p class="eyebrow">3 points for one clue, 2 for two, 1 for three.</p>';
      }
      el.addEventListener("click", function (e) {
        var chip = e.target.closest(".chip");
        if (chip && picked === null) {
          picked = chip.getAttribute("data-id");
          if (picked === order[r]) score += 3 - c;
          draw(); return;
        }
        if (e.target.id === "who-clue" && c < 2) { c++; draw(); return; }
        if (e.target.id === "who-next") { r++; c = 0; picked = null; draw(); return; }
        if (e.target.id === "who-restart") start();
      });
      start();
    })();
  }
})();
