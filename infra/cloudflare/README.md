# Edge rate limiting

WAF rate-limiting rules run before the Worker, so blocked requests cost nothing
(docs/ARCHITECTURE.md §3.1). Configure them in the Cloudflare dashboard (Security → WAF →
Rate limiting rules) for the API's hostname. Starting values; tune with real traffic.

| Rule | Matches | Characteristic | Limit | Action |
|---|---|---|---|---|
| Public tracking | `http.request.uri.path wildcard "/t/*"` | IP | 30 requests / 1 min | Block 10 min |
| API general | `starts_with(http.request.uri.path, "/v1/")` | IP | 300 requests / 1 min | Block 1 min |

**SMS login codes** are sent by the auth provider (Supabase Auth), not by this API, so limit them
there: Supabase Auth → Rate Limits (SMS per hour) plus CAPTCHA on sign-in. If login moves behind
our own endpoint later, add a rule here: 3 per 10 min per phone number, 10 per hour per IP.

Limits enforced in the API itself, because they need state:
- delivery code: 5 wrong attempts per delivery, then locked for ops;
- delivery-code SMS: 3 sends per delivery.
