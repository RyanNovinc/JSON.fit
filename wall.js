/* Hero food wall, shared by every page that mounts a <div id="fWall">.
   Real meal photos from the JSON.fit library (r/meals.json), not a hardcoded list.

   Add data-rings="true" on the #fWall element for the ring/"LOGGED" treatment
   (used on the homepage); omit it for a plain name+macro card (used elsewhere,
   e.g. the cookbook page).

   Load order: a placeholder pass first measures how many columns the screen
   actually needs (no images touched), then the real columns are built and the
   ones nearest the visual centre get fetchpriority="high" so the part of the
   wall people actually look at wins the network race, with the outermost
   columns marked "low" since they're the least seen.

   Motion: this file is fully self-contained. It injects its own #fWall-scoped
   style overrides (higher specificity than the legacy .f-track rules), so NO
   per-page CSS edits are needed anywhere the wall is embedded. Every column
   is appended to the DOM first, then start() measures one full cycle (n
   cards, valid only in-document) and sets --fdrift-duration before adding
   the .run class, so the animation never plays at a fallback speed. The
   keyframe is a static translateY(-50%), which keeps the drift on the
   compositor and immune to scroll and resize jank; the card gap lives in
   .f-card margin-bottom so -50% equals exactly one card set. */
(function(){
var POOL = [
  ["Butter Chicken", "butter-chicken-curry", 490, 48],
  ["Butter Chicken with Basmati Rice", "butter-chicken-with-rice", 720, 52],
  ["Brekkie to GROW-Grow", "brekkie-grow", 1185, 64],
  ["Mango Mass", "mango-mass", 1147, 52],
  ["King Kong Chocolate", "king-kong-chocolate", 1418, 85],
  ["Strawberry Stack", "strawberry-stack", 1157, 56],
  ["Choc Muscle MAXX", "choc-muscle-maxx", 1111, 77],
  ["Cookies & Gains", "cookies-gains", 1148, 56],
  ["Raspberry Rip", "raspberry-rip", 1070, 54],
  ["Energy Lift Heavy", "energy-lift-heavy", 961, 52],
  ["Mornin' Muscle", "mornin-muscle", 1192, 57],
  ["Dirty Eden", "dirty-eden", 1165, 57],
  ["Strawbrekkie BEAST", "strawbrekkie-beast", 1244, 63],
  ["Banana Bulk", "banana-bulk", 1302, 64],
  ["BBQ Pulled Pork", "pulled-pork", 610, 48],
  ["BBQ Pulled Pork Burger", "pulled-pork-sandwich", 1210, 61],
  ["Pulled Pork Rice Bowl", "pulled-pork-bowl", 1330, 61],
  ["Loaded Pulled Pork Baked Potato", "pulled-pork-baked-potato", 1177, 60],
  ["Pulled Pork Tacos", "pulled-pork-tacos", 1155, 61],
  ["Pulled Pork Mac & Cheese Stack", "pulled-pork-mac-cheese", 1907, 102],
  ["Bolognese", "bolognese", 510, 32],
  ["Spaghetti Bolognese", "bolognese-spaghetti", 996, 48],
  ["Loaded Bolognese Baked Potato", "bolognese-baked-potato", 1007, 44],
  ["Bolognese with Garlic Bread", "bolognese-garlic-bread", 968, 42],
  ["Bolognese Lasagne", "bolognese-lasagne", 1130, 62],
  ["Massaman Beef Curry", "massaman", 890, 52],
  ["Massaman Beef Curry with Rice", "massaman-rice", 1403, 59],
  ["Chilli Con Carne", "chilli-con-carne", 620, 42],
  ["Bulking Chilli Bowl", "chilli-con-carne-bowl", 1263, 52],
  ["Loaded Chilli Nachos", "chilli-con-carne-nachos", 1319, 53],
  ["Red Wine\u2013Braised Lamb Shank", "lamb-shanks", 825, 54],
  ["Lamb Shank on Creamy Mash", "lamb-shanks-mash", 1417, 57],
  ["Red Wine Beef Stew", "beef-stew", 700, 46],
  ["Beef Stew on Creamy Mash", "beef-stew-mash", 1288, 52],
  ["Beef Stew with Crusty Bread", "beef-stew-bread", 977, 52],
  ["Maple Muscle Toast", "maple-muscle-toast", 1050, 60],
  ["Muscle Oats", "muscle-oats", 960, 53],
  ["Scramble Stack", "scramble-stack", 700, 42],
  ["Protein Overnight Oats", "overnight-oats", 770, 47],
  ["Greek Yoghurt Power Bowl", "greek-yoghurt-bowl", 740, 47],
  ["Cottage Cheese Power Bowl", "cottage-cheese-bowl", 380, 28],
  ["PB Banana Toast", "pb-banana-toast", 840, 45],
  ["Protein Pancakes", "protein-pancakes", 760, 52],
  ["Steak & Eggs", "steak-and-eggs", 820, 65],
  ["Shakshuka", "shakshuka", 880, 46],
  ["Freezer Breakfast Burrito", "freezer-breakfast-burrito", 680, 37],
  ["Baked Oats", "baked-oats", 800, 51],
  ["Smoked Salmon Bagel", "smoked-salmon-bagel", 790, 44],
  ["Big Breakfast Plate", "big-breakfast-plate", 1130, 70],
  ["Egg Muffins", "egg-muffins", 790, 44],
  ["Protein Ice Cream", "protein-ice-cream", 320, 40],
  ["Cottage Cheese Ice Cream", "cottage-cheese-ice-cream", 390, 29],
  ["Chocolate Protein Mug Cake", "chocolate-protein-mug-cake", 325, 34],
  ["Fudgy Protein Brownies", "fudgy-protein-brownies", 245, 13],
  ["Protein Chocolate Chip Cookies", "protein-chocolate-chip-cookies", 210, 11],
  ["Protein Banana Bread", "protein-banana-bread", 190, 10],
  ["Edible Protein Cookie Dough", "edible-protein-cookie-dough", 340, 20],
  ["No-Bake Protein Cheesecake", "no-bake-protein-cheesecake", 380, 22],
  ["Chocolate Protein Mousse", "chocolate-protein-mousse", 395, 38],
  ["Frozen Date Snickers Bark", "frozen-date-snickers-bark", 190, 6],
  ["Pala\u010dinke (Croatian Cr\u00eapes)", "palacinke", 463, 12],
  ["Greek Yogurt", "greek-yogurt-snack", 170, 17],
  ["Beef Jerky", "beef-jerky", 115, 14],
  ["Edamame", "edamame", 190, 17],
  ["Protein Shake", "protein-shake", 250, 35],
  ["Protein Bar", "protein-bar", 220, 20],
  ["Cheese", "cheese-snack", 115, 7],
  ["Hard-Boiled Eggs", "hard-boiled-eggs", 140, 12],
  ["Tuna Pouch", "tuna-pouch", 110, 25],
  ["Roasted Chickpeas", "roasted-chickpeas", 190, 10],
  ["No-Bake Protein Balls", "no-bake-protein-balls", 150, 8],
  ["Mixed Nuts", "mixed-nuts", 250, 9],
  ["Trail Mix", "trail-mix", 290, 8],
  ["Banana", "banana-snack", 105, 1],
  ["Dried Fruit", "dried-fruit", 130, 1],
  ["Dark Chocolate", "dark-chocolate", 170, 2],
  ["Teriyaki Chicken Rice Bowl", "teriyaki-chicken-rice-bowl", 890, 56],
  ["Beef & Broccoli Stir-Fry", "beef-broccoli-stir-fry", 860, 52],
  ["Thai Basil Chicken over Rice", "thai-basil-chicken-over-rice-standard", 736, 44],
  ["Thai Basil Chicken with Fried Egg", "thai-basil-chicken-with-fried-egg-fried-egg", 807, 50],
  ["Beef Bulgogi over Jasmine Rice", "beef-bulgogi-bowl", 820, 50],
  ["Spaghetti Carbonara", "spaghetti-carbonara", 1080, 54],
  ["Salmon, Roast Potatoes & Greens", "sheet-pan-salmon-potatoes", 780, 46],
  ["Chicken Fajita Bowl", "chicken-fajita-bowl", 770, 56],
  ["Spicy Chipotle Chicken Burrito", "spicy-chipotle-chicken-burrito-standard", 933, 56],
  ["Spicy Chipotle Chicken Burrito Bowl", "spicy-chipotle-chicken-burrito-bowl-burrito-bowl", 747, 51],
  ["Chicken Shawarma Wrap", "chicken-shawarma-wrap-wrap", 738, 51],
  ["Chicken Shawarma Rice Bowl", "chicken-shawarma-rice-bowl-rice-bowl", 793, 50],
  ["Satay Chicken over Jasmine Rice", "satay-chicken", 919, 50],
  ["Honey Chicken over Jasmine Rice", "honey-chicken", 786, 54],
  ["Chicken Mac and Cheese", "chicken-mac-and-cheese", 935, 80],
  ["Turkey Meatballs & Spaghetti", "turkey-meatballs-spaghetti", 810, 56],
  ["Tuna Pasta Bake", "tuna-pasta-bake", 795, 57],
  ["Lamb Kofta Rice Bowl", "lamb-kofta-rice-bowl", 857, 53],
  ["Lamb Kofta Wrap", "lamb-kofta-wrap-wrap", 856, 55],
  ["Sheet-Pan Sausage & Veg", "sheet-pan-sausage-veg", 733, 44],
  ["Honey Soy Salmon Noodle Bowl", "honey-soy-salmon-noodles", 820, 53],
  ["Carne Asada Bowl", "carne-asada-bowl", 827, 62],
  ["Schnitzel Plate", "schnitzel-plate-plate", 621, 54],
  ["Schnitzel Roll", "schnitzel-roll-roll", 881, 63],
  ["Chicken Parma", "chicken-parma-parma", 747, 62],
  ["Beef Rag\u00f9 with Gnocchi", "beef-ragu-gnocchi", 856, 53],
  ["\u0106evapi with Flatbread", "cevapi-flatbread", 806, 51],
  ["\u0106evapi Rice Plate", "cevapi-rice-plate", 760, 48],
  ["Chicken Schnitzel", "chicken-schnitzel", 621, 54],
  ["Chicken Shawarma", "chicken-shawarma", 738, 51],
  ["Lamb Kofta", "lamb-kofta", 857, 53],
  ["Spicy Chipotle Chicken Burrito", "spicy-chipotle-chicken-burrito", 933, 56],
  ["Thai Basil Chicken", "thai-basil-chicken", 736, 44]
];

    var PER_COLUMN = 10;                  // unique meals per column: raise for more variety, lower to save data
    var SPEED = { normal: 13, rev: 10 };  // px/second before the wall's 1.18 scale (about 15px/s on screen). Range that works: 9/7 slow drift, 18/14 original design pace.
    var DONE_CHANCE = 0.3;                // fraction of cards shown as already "logged" (rings only)
    var MIN_COLS = 4, MAX_COLS = 8;       // desktop range; real edge coverage decides the exact count, not a guess

    var wall = document.getElementById('fWall');
    if (!wall) return;
    var showRings = wall.dataset.rings === 'true';

    // Self-contained motion styles. Scoped to #fWall so they outrank the legacy
    // .f-track rules already in each page's stylesheet: no HTML edits required,
    // and every page that embeds this wall gets the fix automatically.
    (function(){
        if (document.getElementById('fwall-motion-css')) return;
        var st = document.createElement('style');
        st.id = 'fwall-motion-css';
        st.textContent =
            '#fWall .f-track{gap:0;animation:none;}' +
            '#fWall .f-card{margin-bottom:20px;}' +
            '#fWall .f-track.run{animation:fdriftRun var(--fdrift-duration,300s) linear infinite;}' +
            '#fWall .f-col.rev .f-track.run{animation-direction:reverse;}' +
            '@keyframes fdriftRun{to{transform:translateY(-50%);}}' +
            '@media (max-width:860px){#fWall .f-card{margin-bottom:14px;}}' +
            '@media (prefers-reduced-motion:reduce){#fWall .f-track.run{animation:none;}}';
        document.head.appendChild(st);
    })();

    function shuffle(arr){
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
    }

    function buildCard(entry, priority){
        var done = showRings && Math.random() < DONE_CHANCE;
        var card = document.createElement('div');
        card.className = 'f-card';

        var img = document.createElement('img');
        img.alt = '';
        if (priority) img.setAttribute('fetchpriority', priority);
        img.src = '/images/meals/' + entry[1] + '.webp';
        img.dataset.fallback = '/images/meals/' + entry[1] + '.png';
        img.onerror = function(){
            if (this.src.indexOf('.webp') > -1) { this.src = this.dataset.fallback; }
            else { this.style.display = 'none'; }
        };

        var meta = document.createElement('div');
        meta.className = 'f-meta';

        if (showRings) {
            var ring = document.createElement('span');
            ring.className = done ? 'f-ring done' : 'f-ring';
            meta.appendChild(ring);
        }

        var info = document.createElement('div');
        var name = document.createElement('div');
        name.className = (showRings && done) ? 'f-name done' : 'f-name';
        name.textContent = entry[0];
        var kcal = document.createElement('div');
        kcal.className = 'f-kcal';
        kcal.textContent = entry[2] + ' KCAL \u00B7 ' + ((showRings && done) ? 'LOGGED' : entry[3] + 'P');
        info.appendChild(name);
        info.appendChild(kcal);
        meta.appendChild(info);

        card.appendChild(img);
        card.appendChild(meta);
        return card;
    }

    function debounce(fn, ms){
        var t;
        return function(){
            var ctx = this, args = arguments;
            clearTimeout(t);
            t = setTimeout(function(){ fn.apply(ctx, args); }, ms);
        };
    }

    function buildColumn(entries, reverse, priority){
        var col = document.createElement('div');
        col.className = reverse ? 'f-col rev' : 'f-col';
        var track = document.createElement('div');
        track.className = 'f-track';
        col.appendChild(track);

        var n = entries.length;
        entries.forEach(function(e){ track.appendChild(buildCard(e, priority)); });
        entries.forEach(function(e){ track.appendChild(buildCard(e, priority)); }); // duplicate set: this is what makes the loop seamless

        var lastShift = null;
        col.start = function(){
            var first = track.children[0];
            var firstOfClone = track.children[n];
            if (!first || !firstOfClone) return;
            var shift = firstOfClone.offsetTop - first.offsetTop; // exact px for one full cycle, only measurable once the column is in the document
            if (shift <= 0) return;
            if (lastShift !== null && Math.abs(shift - lastShift) < 1) return; // nothing real changed (e.g. mobile URL bar resize): leave the running animation alone
            lastShift = shift;
            var speed = reverse ? SPEED.rev : SPEED.normal;
            track.style.setProperty('--fdrift-duration', (shift / speed) + 's');
            track.classList.add('run'); // the animation only begins once its true duration exists, so it never plays at a fallback speed
        };
        window.addEventListener('resize', debounce(col.start, 200));
        return col;
    }

    var isMobile = window.matchMedia('(max-width: 860px)').matches;
    var colTarget = isMobile ? 2 : MIN_COLS; // minimum columns before checking coverage
    var colCap = isMobile ? 2 : MAX_COLS;    // hard ceiling so an ultrawide monitor can't load unbounded images

    // ---- Phase 1: how many columns does this screen actually need? Empty divs, zero images, zero network cost. ----
    var N = colCap;
    if (colTarget < colCap) {
        var probes = [];
        for (var p = 0; p < colCap; p++) {
            var probe = document.createElement('div');
            probe.className = 'f-col';
            wall.appendChild(probe);
            probes.push(probe);
            if (probes.length >= colTarget) {
                var fe = probes[0].getBoundingClientRect();
                var le = probes[probes.length - 1].getBoundingClientRect();
                if (fe.left <= 0 && le.right >= window.innerWidth) { N = probes.length; break; }
            }
        }
        probes.forEach(function(el){ wall.removeChild(el); });
    }

    // ---- Phase 2: build and append every column first, THEN start them, so offsetTop is measured in-document ----
    var shuffled = shuffle(POOL.slice());
    var perCol = Math.min(PER_COLUMN, Math.floor(shuffled.length / N));
    var used = 0;
    function nextSlice(){
        var slice = shuffled.slice(used, used + perCol);
        used += perCol;
        return slice;
    }

    var dists = [];
    for (var i = 0; i < N; i++) dists.push(Math.abs(i - (N - 1) / 2));
    var minDist = Math.min.apply(null, dists);
    var maxDist = Math.max.apply(null, dists);

    var cols = [];
    for (var i = 0; i < N; i++) {
        var priority = null;
        if (dists[i] === minDist) priority = 'high';
        else if (dists[i] === maxDist) priority = 'low';
        var c = buildColumn(nextSlice(), i % 2 === 1, priority);
        wall.appendChild(c);
        cols.push(c);
    }
    cols.forEach(function(c){ c.start(); });
})();
