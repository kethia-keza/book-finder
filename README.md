# Gem Finder

## Links

-Demo Video:https://youtu.be//7rt7LJxqfCE?si=hA-0nSQngW6M2bEC
-Live App(Load balancer):http://35.178.250.254
-Web01:http://3.10.24.92
-Web02:http://18.170.66.234
-Repository:https://github.com/kethia-keza/book-finder

## Features

- Search by Title, author or keyword (Search button and Enter the key)
- Sort: relevance, newest, oldest, top rated, most editions
- Filter:Subject , language, "published after" year
- Book cards with cover, author, first  publish year, rating, number of editions and a link to Open Library
- Reading List: save and remove books, stored in the browser (localStorage)
- "Load more" pagination and a loading indicator
- In-memory caching of API responses to reduce repeat requests
- Error handling: offline, timeout, rate limit (249), API error,empty results
- Missing covers and authors handled with placeholders
- All API data is rendered with `textContent` (protection against XSS)
- Footer shows which server answered (used to prove load balancing)

## API used

-[Open Library Search API](https://openlibrary.org/dev/docs/api/search)
-[Open Library Covers API](https://openlibrary.org/dev/docs/api/covers)
Thanks to Open Library and Internet Archive for providing free, open data.
 No API key is required.

 ##  Run locally

```bash
 gitclone https://github.com/kethia-keza/book-finder.git
 cd book-finder

 Open the folder in VS Code , install the **Live Server** extension,right-click `index.html` and choose **Open with Live Server**.
(Alternatively run `npx serve` and open the printed URL.)

## Deployment (Web01 and Web02)

Performed on both servers (`ssh ubuntu@<server-ip>`):

```bash
sudo apt update && sudo apt install -y nginx git
sudo git clone https://github.com/kethia-keza/book-finder.git/var/www/book-finder

sudo ln -sf /etc/nginx/sites-available/book-finder  /etc/nginx/sites-enabled/book-finder
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
curl http://localhost/health
```

The Nginx config (`deploy/nginx.conf`) serves the static files from `/var/www/book-finder`,adds an `X-Served-By` header, and exposes `/health`, which returns the server hostname as JSON.

To update later: `sudo git -C /var/www/book-finder pull` on both servers.


# Load balancer (Lb01)

HAProxy runs on Lb01. The block in `deploy/haproxy.cfg` is appended to `/etc/haproxy/haproxy.cfg`:


- `balance roundrobin` alternated requests between Web01 and Web02
- `option httpchk GET /health` with `check` removes a server from rotation if it stops answering

```bash 
sudo haproxy -c -f /etc/haproxy/haproxy.cfg
sudo systemctl restart haproxy
```

### Testing

```bash
for i in {1..10}; do curl -s -w " (HTTP %{http_code})\n" http://35.178.250.254/health; done
```

All 10 requests return 200, and the `server` value alternates `7324-web-01` and `7324-web-02`.

Failover test: stopping Nginx on Web01 (`sudo systemctl stop nginx`) sent all traffic to Web02;

## Security

- No secrets are used: Open Library needs no API key
- `.gitignore` excludes `.env`, `node_modules/` and `.DS_Store`
- API data is only placed into the a page with `textContent`, never `innerHTML`
- Search text is URL-encoded with `URLSearchParams`

## Challenges and how I solved them

-Syntax errors in JS/CSS: fixed using the VS Code Problems panel(unclosed template strings, missing semicolons, misspelled keywords).
-Missing covers/authors: added placeholders and fallbacks so cards never break.
-Inconsistent field names in the API docs (`numFound` /`num_found`):the code handles both.
-Minimal Ubuntu servers had no `nano: created config files with `sudo tee` and heredocs.
-Proving load balancing: added a `/health` endpoint and an `X-Served-By` header that show the server hostname.
-Intermittent HTTP 301 redirects in the load balancer:Lb01 already had a `www-http` frontend that redirected port 80 to HTTPS.Because my `http_front` also bound port 80 , about half of requests were redirected. I found it by looping `curl -s -w "%{http_code}"` and inspecting the `Location` header, then removed the old redirect frontend (after backing up the config) and re-tested: 10 of 10 requests returned 200, alternating between web-01 and web-02.

## Credits
- [Open Library](https://openlibrary.org) - book and covers
- [Internet Archive](https://archive.org)
- Nginx, HAProxy, VS Code Live Server

## Credentials

No Api key and no login are required to use the application.

