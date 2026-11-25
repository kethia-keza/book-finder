const $ =(id) => document.getElementById(id);
const API = 'https://openlibrary.org/search.json';
const FIELDS = 'key,title,author_name,first_publish_year,cover_i,edition_count,ratings_average';
const PAGE_SIZE = 12;

let page= 1, total = 0, loaded = 0, loading = false;
let saved =loadSaved();
const cache = new Map();


function loadSaved() {
    try { return JSON.parse(localStorage.getItem('readingList') || '[]'); }
    catch { return []; }
}
function persistSaved() {
    try { localStorage.setItem('readingList', JSON.stringify(saved)); } catch {}
}

function setStatus(text, type = ''){
    $('status').className = type;
    $('status').textContent = text;
}

function showLoading() {
    $('status').className = '';
    $('status').innerHTML = '<span class="spinner"></span>Loading...';

}
function makePlaceholder(cls) {
    const d = document.createElement('div');
    d.className = `${cls} placeholder`;
    d.textContent = '📕';
    return d;

}

function makeCover(book, cls = 'cover') {
    if(!book.coverId) return makePlaceholder(cls);
    const img = document.createElement('img');
    img.className = cls;
    img.src = `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`;
    img.alt = ` Cover of ${book.title}`;
    img.loading = 'lazy';
    img.onerror = () => img.replaceWith(makePlaceholder(cls));
    return img;
}

const isSaved = (key) => saved.some((b) =>b.key === key );

async function showServer() {
    try {
        const r = await fetch('/health', { cache: 'no-store' });
        const d = await r.json();
        $('server').textContent = `Served by: ${d.server}`;
    } catch {
        $('server').textContent = '';
    }
}

function buildUrl(pageNum) {
    let query =$('q').value.trim();
    if ($('subject').value) query += ` subject:"${$('subject').value}"`;
    if($('language').value) query += ` language:${$('language').value}`;
    const year = $('afterYear').value;
    if (/^\d{4}$/.test(year)) query += ` first_publish_year:[${year} TO *]`;


    const p = new URLSearchParams({ q: query, fields: FIELDS, page: pageNum, limit: PAGE_SIZE  });
    if ($('sort').value !== 'relevance') p.set('sort' , $('sort').value);
    return `${API}?${p}`;

}
    async function fetchBooks(url) {
    if (cache.has(url)) return {...cache.get (url), cached: true };
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.');
  if (!res.ok) throw new Error(`Open Library returned an error (${res.status}).`);

  const d = await res.json();
  const data = {
    total: d.numFound ?? d.num_found ?? 0, // the docs show both spellings
    books: (d.docs || []).map((b) => ({
      key: b.key,
      title: b.title || 'Untitled',
      authors: b.author_name || [],
      year: b.first_publish_year || null,
      coverId: b.cover_i || null,
      editions: b.edition_count || 0,
      rating: b.ratings_average ? Number(b.ratings_average.toFixed(1)) : null,
    })),
  };
  cache.set(url, data);
  return { ...data, cached: false };
}

async function search(reset) {
  if (loading) return;
  if (!$('q').value.trim()) return setStatus('Type something to search.', 'error');
  if (!navigator.onLine) return setStatus('You appear to be offline. Check your internet connection.', 'error');

  if (reset) {
    page = 1;
    loaded = 0;
    $('results').innerHTML = '';
    $('loadMore').hidden = true;
  }
  loading = true;
  $('loadMore').disabled = true;
  showLoading();

  try {
    const data = await fetchBooks(buildUrl(page));
    total = data.total;
    loaded += data.books.length;
    data.books.forEach((b) => $('results').appendChild(renderCard(b)));

    if (total === 0) setStatus('No books found. Try different words or remove filters.');
    else setStatus(`Showing ${loaded} of ${total.toLocaleString()} results${data.cached ? ' (cached)' : ''}`);

    $('loadMore').hidden = loaded >= total || data.books.length === 0;
    showServer();
  } catch (err) {
    let msg = err.message;
    if (err.name === 'TimeoutError') msg = 'Open Library took too long to respond. Try again.';
    else if (err instanceof TypeError) msg = 'Could not reach Open Library. Check your internet connection.';
    setStatus(msg, 'error');
  } finally {
    loading = false;
    $('loadMore').disabled = false;
  }
}

// ---------- Rendering (textContent everywhere = XSS-safe) ----------
function renderCard(book) {
  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('h3');
  title.textContent = book.title;

  const author = document.createElement('div');
  author.className = 'meta';
  author.textContent = book.authors.length ? book.authors.slice(0, 2).join(', ') : 'Unknown author';

  const info = document.createElement('div');
  info.className = 'meta';
  const parts = [book.year ? `First published ${book.year}` : 'Year unknown'];
  if (book.rating) parts.push(`⭐ ${book.rating}`);
  parts.push(`${book.editions} edition${book.editions === 1 ? '' : 's'}`);
  info.textContent = parts.join(' · ');

  const link = document.createElement('a');
  link.href = `https://openlibrary.org${book.key}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'View on Open Library ↗';

  const btn = document.createElement('button');
  const refresh = () => {
    btn.textContent = isSaved(book.key) ? '✓ Saved (click to remove)' : '+ Save to reading list';
    btn.classList.toggle('saved', isSaved(book.key));
  };
  btn.onclick = () => { toggleSave(book); refresh(); };
  refresh();

  card.append(makeCover(book), title, author, info, link, btn);
  return card;
}

function toggleSave(book) {
  saved = isSaved(book.key) ? saved.filter((b) => b.key !== book.key) : [...saved, book];
  persistSaved();
  renderSaved();
}

function renderSaved() {
  $('savedCount').textContent = saved.length;
  const box = $('savedList');
  box.innerHTML = '';
  if (!saved.length) {
    box.textContent = 'No saved books yet. Click "Save" on any book.';
    return;
  }

  saved.forEach((b) => {
    const row = document.createElement('div');
    row.className = 'savedItem';

    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('strong');
    t.textContent = b.title;
    const a = document.createElement('div');
    a.textContent = b.authors[0] || 'Unknown author';
    const l = document.createElement('a');
    l.href = `https://openlibrary.org${b.key}`;
    l.target = '_blank';
    l.rel = 'noopener';
    l.textContent = 'Open ↗';
    info.append(t, a, l);

    const rm = document.createElement('button');
    rm.textContent = '✕';
    rm.setAttribute('aria-label', `Remove ${b.title}`);
    rm.onclick = () => {
      saved = saved.filter((x) => x.key !== b.key);
      persistSaved();
      renderSaved();
      // Refresh the Save buttons in the results grid (served from cache)
      if ($('results').children.length) search(true);
    };

    row.append(makeCover(b, 'thumb'), info, rm);
    box.appendChild(row);
  });
}

// ---------- Events ----------
$('searchForm').addEventListener('submit', (e) => { e.preventDefault(); search(true); }); // button + Enter
['sort', 'subject', 'language', 'afterYear'].forEach((id) =>
  $(id).addEventListener('change', () => { if ($('q').value.trim()) search(true); }));
$('loadMore').addEventListener('click', () => { page += 1; search(false); });
$('toggleSaved').addEventListener('click', () => { $('savedPanel').hidden = !$('savedPanel').hidden; });
$('closeSaved').addEventListener('click', () => { $('savedPanel').hidden = true; });

// ---------- Start ----------
renderSaved();
$('q').value = 'chinua achebe';
search(true);
    